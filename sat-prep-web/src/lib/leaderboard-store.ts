import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeMastery, type SkillMastery } from './mastery';
import { computeStats } from './stats';
import { rankEntries, type RankRow, type RankedResult } from './leaderboard';
import { getCurrentSeasonKey, getSeasonLabel, daysLeftInSeason } from './season';

/**
 * ============================================================================
 *  LEADERBOARD STORE (I/O) — đọc user_profiles + user_mastery, xếp hạng
 * ============================================================================
 *  🔴 PRIVACY: đọc cross-user CHỈ qua service-role (createAdminClient) — bảng
 *  user_profiles KHÔNG mở public SELECT. Store là điểm kiểm soát DUY NHẤT: chỉ
 *  nickname + basePower rời server (rankEntries đã bỏ userId).
 *
 *  FAIL-SAFE pre-migration: bảng user_profiles chưa tồn tại (42P01/PGRST205) →
 *  loadMyProfile trả null, buildLeaderboard trả available:false → UI "sắp ra
 *  mắt", KHÔNG crash (mẫu loadPvpState economy-store.ts).
 *
 *  TRÁNH N+1: đọc skills của MỌI user opt-in trong 1 query .in('user_id', ids),
 *  rồi summarizeMastery + computeStats IN-MEMORY (không gọi getMasterySummary
 *  từng user). Mẫu batch từ parent-report-store.ts.
 * ============================================================================
 */

/** Lỗi Supabase báo bảng CHƯA tồn tại (migration chưa chạy). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42P01 = undefined_table (Postgres); PGRST205 = bảng không có trong schema cache.
  return error.code === '42P01' || error.code === 'PGRST205';
}

export interface MyProfile {
  nickname: string | null;
  optIn: boolean;
  nicknameUpdatedAt: string | null;
}

/**
 * Đọc profile CỦA MÌNH (RLS own). Trả:
 *   • MyProfile — bình thường (hoặc {null,false,null} nếu chưa có row).
 *   • null — bảng chưa tồn tại (pre-migration) → API trả not_ready.
 */
export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('nickname, opt_in_leaderboard, nickname_updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null; // pre-migration
    console.error('loadMyProfile error:', error.message);
    return { nickname: null, optIn: false, nicknameUpdatedAt: null };
  }

  if (!data) return { nickname: null, optIn: false, nicknameUpdatedAt: null };
  return {
    nickname: data.nickname ?? null,
    optIn: data.opt_in_leaderboard === true,
    nicknameUpdatedAt: data.nickname_updated_at ?? null,
  };
}

export interface SaveProfileInput {
  nickname?: string; // đã validate ở API
  optIn?: boolean;
}

/**
 * Ghi profile CỦA MÌNH (upsert, RLS own). Set nickname_updated_at khi đổi
 * nickname (để API áp cooldown). Trả false nếu bảng chưa có / lỗi ghi.
 */
export async function saveMyProfile(userId: string, input: SaveProfileInput): Promise<boolean> {
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.nickname === 'string') {
    row.nickname = input.nickname;
    row.nickname_updated_at = new Date().toISOString();
  }
  if (typeof input.optIn === 'boolean') row.opt_in_leaderboard = input.optIn;

  const { error } = await supabase.from('user_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) {
    if (isMissingTable(error)) return false; // pre-migration
    console.error('saveMyProfile error:', error.message);
    return false;
  }
  return true;
}

export interface LeaderboardView {
  season: { key: string; label: string; daysLeft: number };
  top: RankedResult['top'];
  me: RankedResult['me'];
  /** false = bảng chưa tồn tại (pre-migration) → UI "sắp ra mắt". */
  available: boolean;
}

// Cache in-memory ngắn (60s) theo season key — leaderboard chỉ hiển thị, chấp
// nhận lệch tối đa 60s. Reset mỗi cold-start serverless (như rate-limit).
interface CacheEntry { at: number; rows: RankRow[]; seasonKey: string }
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Dựng bảng xếp hạng (top N + vị trí của mình). now được TIÊM (mặc định thời
 * điểm gọi) — cho phép test/route truyền thời gian xác định.
 */
export async function buildLeaderboard(
  myUserId: string,
  topN: number,
  now: Date = new Date()
): Promise<LeaderboardView> {
  const seasonKey = getCurrentSeasonKey(now);
  const season = { key: seasonKey, label: getSeasonLabel(seasonKey), daysLeft: daysLeftInSeason(now) };

  const admin = createAdminClient();

  // Cache hit (cùng mùa, còn hạn) → dùng lại rows, chỉ tính lại rank cho myUserId.
  if (_cache && _cache.seasonKey === seasonKey && now.getTime() - _cache.at < CACHE_TTL_MS) {
    const { top, me } = rankEntries(_cache.rows, myUserId, topN);
    return { season, top, me, available: true };
  }

  // 1) Danh sách user đã opt-in + nickname (service-role).
  const { data: profiles, error: pErr } = await admin
    .from('user_profiles')
    .select('user_id, nickname')
    .eq('opt_in_leaderboard', true);

  if (pErr) {
    if (isMissingTable(pErr)) return { season, top: [], me: null, available: false };
    console.error('buildLeaderboard profiles error:', pErr.message);
    return { season, top: [], me: null, available: false };
  }

  const opted = (profiles ?? []).filter(
    (p): p is { user_id: string; nickname: string } =>
      typeof p.user_id === 'string' && typeof p.nickname === 'string' && p.nickname.length > 0
  );
  if (opted.length === 0) {
    _cache = { at: now.getTime(), rows: [], seasonKey };
    return { season, top: [], me: null, available: true };
  }

  // 2) MỘT query mastery cho MỌI user opt-in (tránh N+1).
  const ids = opted.map((p) => p.user_id);
  const { data: masteryRows, error: mErr } = await admin
    .from('user_mastery')
    .select('user_id, skills')
    .in('user_id', ids);

  if (mErr) {
    console.error('buildLeaderboard mastery error:', mErr.message);
    return { season, top: [], me: null, available: true };
  }

  // 3) Tính basePower in-memory (summarizeMastery + computeStats thuần).
  const skillsByUser = new Map<string, Record<string, SkillMastery>>();
  for (const r of masteryRows ?? []) {
    if (typeof r.user_id === 'string') {
      skillsByUser.set(r.user_id, (r.skills ?? {}) as Record<string, SkillMastery>);
    }
  }

  const rows: RankRow[] = opted.map((p) => {
    const skills = skillsByUser.get(p.user_id) ?? {};
    const summary = summarizeMastery(skills);
    const { basePower } = computeStats(summary, 0); // equipmentBonus=0 (chỉ năng lực học)
    return { userId: p.user_id, nickname: p.nickname, basePower };
  });

  _cache = { at: now.getTime(), rows, seasonKey };
  const { top, me } = rankEntries(rows, myUserId, topN);
  return { season, top, me, available: true };
}
