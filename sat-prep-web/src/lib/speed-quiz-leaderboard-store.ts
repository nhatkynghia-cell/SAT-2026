import { createAdminClient } from '@/lib/supabase/admin';
import { rankEntries, type RankRow, type RankedResult } from './leaderboard';
import { getCycleKey, getCycleLabel, msLeftInCycle, type SeasonCycle } from './season';
import { getUsersTierMap } from './subscription-store';

/**
 * ============================================================================
 *  SPEED QUIZ LEADERBOARD STORE (I/O) — xếp hạng theo LƯỢT TỐT NHẤT trong kỳ
 * ============================================================================
 *  Metric = MAX(correct_count) mỗi user trong cycle key (day/week/month/year).
 *  Server chấm (issued_questions.was_correct) nên KHÔNG fake được số câu đúng.
 *
 *  🔴 PRIVACY: đọc cross-user CHỈ qua service-role; chỉ nickname + score rời
 *  server (rankEntries bỏ userId). Chỉ tính user đã opt_in_leaderboard.
 *
 *  FAIL-SAFE pre-migration: bảng speed_quiz_sessions/user_profiles chưa có
 *  (42P01/PGRST205) → available:false → UI "sắp ra mắt". Mẫu leaderboard-store.ts.
 *
 *  Cache 60s/cycleKey (chấp nhận lệch tối đa 60s như leaderboard mastery).
 * ============================================================================
 */

function isMissingTable(error: { code?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205';
}

/** Cột cycle key trong speed_quiz_sessions theo loại chu kỳ. */
const CYCLE_COLUMN: Record<SeasonCycle, string> = {
  day: 'day_key',
  week: 'week_key',
  month: 'month_key',
  year: 'year_key',
};

export interface SpeedQuizLeaderboardView {
  cycle: SeasonCycle;
  cycleKey: string;
  cycleLabel: string;
  msLeft: number;
  top: RankedResult['top'];
  me: RankedResult['me'];
  available: boolean;
}

interface CacheEntry { at: number; rows: RankRow[]; cycleKey: string }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

/**
 * Dựng bảng xếp hạng Speed Quiz cho một cycle. now được TIÊM (test/route truyền
 * thời gian xác định). `basePower` trong RankRow ở đây MANG NGHĨA số câu đúng
 * của lượt tốt nhất (tái dùng rankEntries thuần — sort giảm dần đúng ý).
 *
 * `bracket='ultimate'` → GIẢI ĐẤU ĐỘC QUYỀN: sau khi gom user có lượt, lọc CHỈ
 * giữ user gói ultimate (getUsersTierMap) TRƯỚC khi rank. KHÔNG đổi metric (vẫn
 * MAX(correct_count) server-chấm). Không ai đủ điều kiện → bảng rỗng. Cache tách
 * riêng theo bracket để không trộn bảng chung với bảng giải đấu.
 */
export async function buildSpeedQuizLeaderboard(
  myUserId: string,
  cycle: SeasonCycle,
  topN: number,
  now: Date = new Date(),
  bracket?: 'ultimate'
): Promise<SpeedQuizLeaderboardView> {
  const cycleKey = getCycleKey(now, cycle);
  const base = {
    cycle,
    cycleKey,
    cycleLabel: getCycleLabel(cycleKey, cycle),
    msLeft: msLeftInCycle(now, cycle),
  };

  const admin = createAdminClient();

  // Khoá cache tách bracket (bảng chung vs giải đấu ultimate không trộn nhau).
  const cacheKey = bracket ? `${cycle}:${bracket}` : cycle;

  // Cache hit (cùng cycleKey, còn hạn) → chỉ tính lại rank cho myUserId.
  const cached = _cache.get(cacheKey);
  if (cached && cached.cycleKey === cycleKey && now.getTime() - cached.at < CACHE_TTL_MS) {
    const { top, me } = rankEntries(cached.rows, myUserId, topN);
    return { ...base, top, me, available: true };
  }

  // 1) Các lượt ĐÃ KẾT THÚC trong kỳ này (chỉ user opt-in lọc ở bước 3).
  const column = CYCLE_COLUMN[cycle];
  // Chỉ SELECT user_id + correct_count; lọc theo cột cycle động qua .eq() (không
  // đưa cột động vào .select vì typed-client không parse được template string).
  const { data: sessions, error: sErr } = await admin
    .from('speed_quiz_sessions')
    .select('user_id, correct_count')
    .eq(column, cycleKey)
    .not('ended_at', 'is', null);

  if (sErr) {
    if (isMissingTable(sErr)) return { ...base, top: [], me: null, available: false };
    console.error('buildSpeedQuizLeaderboard sessions error:', sErr.message);
    return { ...base, top: [], me: null, available: false };
  }

  // MAX(correct_count) mỗi user trong kỳ (lượt tốt nhất).
  const bestByUser = new Map<string, number>();
  for (const s of (sessions ?? []) as Array<{ user_id: string; correct_count: number }>) {
    if (typeof s.user_id !== 'string') continue;
    const prev = bestByUser.get(s.user_id) ?? 0;
    if (s.correct_count > prev) bestByUser.set(s.user_id, s.correct_count);
  }

  if (bestByUser.size === 0) {
    _cache.set(cacheKey, { at: now.getTime(), rows: [], cycleKey });
    return { ...base, top: [], me: null, available: true };
  }

  // 2) Nickname + opt-in cho các user có lượt (service-role; user_profiles không mở public).
  const ids = [...bestByUser.keys()];
  const { data: profiles, error: pErr } = await admin
    .from('user_profiles')
    .select('user_id, nickname, opt_in_leaderboard')
    .in('user_id', ids)
    .eq('opt_in_leaderboard', true);

  if (pErr) {
    if (isMissingTable(pErr)) return { ...base, top: [], me: null, available: false };
    console.error('buildSpeedQuizLeaderboard profiles error:', pErr.message);
    return { ...base, top: [], me: null, available: false };
  }

  // 2b) GIẢI ĐẤU ULTIMATE: lọc chỉ giữ user gói ultimate TRƯỚC khi rank. Metric
  // KHÔNG đổi (vẫn correct_count). getUsersTierMap: user không có gói vắng khỏi
  // map → coi 'free' → loại; lỗi/pre-migration → {} → mọi user bị loại → bảng rỗng.
  let allowedUltimate: Set<string> | null = null;
  if (bracket === 'ultimate') {
    const tierMap = await getUsersTierMap(ids);
    allowedUltimate = new Set(ids.filter((id) => tierMap[id] === 'ultimate'));
  }

  // 3) Chỉ giữ user opt-in + có nickname; score = lượt tốt nhất. Bracket ultimate
  // loại thêm user không thuộc allowedUltimate.
  const rows: RankRow[] = [];
  for (const p of (profiles ?? []) as Array<{ user_id: string; nickname: string | null }>) {
    if (typeof p.user_id !== 'string' || !p.nickname) continue;
    if (allowedUltimate && !allowedUltimate.has(p.user_id)) continue;
    rows.push({ userId: p.user_id, nickname: p.nickname, basePower: bestByUser.get(p.user_id) ?? 0 });
  }

  _cache.set(cacheKey, { at: now.getTime(), rows, cycleKey });
  const { top, me } = rankEntries(rows, myUserId, topN);
  return { ...base, top, me, available: true };
}

export interface RankedUser {
  userId: string;
  nickname: string;
  score: number;
  rank: number;
}

/**
 * Xếp hạng theo một cycle key TƯỜNG MINH (kỳ đã đóng) — dùng cho cron chốt thưởng
 * cuối kỳ. KHÔNG cache, KHÔNG bỏ userId (cron cần userId để cộng xu). Trả top-N
 * user opt-in theo MAX(correct_count) trong kỳ đó, đã gán rank 1-based.
 * Trả null nếu pre-migration (bảng chưa có) → cron bỏ qua an toàn.
 */
export async function rankUsersForCycleKey(
  cycle: SeasonCycle,
  cycleKey: string,
  topN: number
): Promise<RankedUser[] | null> {
  const admin = createAdminClient();
  const column = CYCLE_COLUMN[cycle];

  const { data: sessions, error: sErr } = await admin
    .from('speed_quiz_sessions')
    .select('user_id, correct_count')
    .eq(column, cycleKey)
    .not('ended_at', 'is', null);

  if (sErr) {
    if (isMissingTable(sErr)) return null;
    console.error('rankUsersForCycleKey sessions error:', sErr.message);
    return null;
  }

  const bestByUser = new Map<string, number>();
  for (const s of (sessions ?? []) as Array<{ user_id: string; correct_count: number }>) {
    if (typeof s.user_id !== 'string') continue;
    const prev = bestByUser.get(s.user_id) ?? 0;
    if (s.correct_count > prev) bestByUser.set(s.user_id, s.correct_count);
  }
  if (bestByUser.size === 0) return [];

  const ids = [...bestByUser.keys()];
  const { data: profiles, error: pErr } = await admin
    .from('user_profiles')
    .select('user_id, nickname, opt_in_leaderboard')
    .in('user_id', ids)
    .eq('opt_in_leaderboard', true);

  if (pErr) {
    if (isMissingTable(pErr)) return null;
    console.error('rankUsersForCycleKey profiles error:', pErr.message);
    return null;
  }

  const rows = ((profiles ?? []) as Array<{ user_id: string; nickname: string | null }>)
    .filter((p) => typeof p.user_id === 'string' && p.nickname)
    .map((p) => ({ userId: p.user_id, nickname: p.nickname as string, score: bestByUser.get(p.user_id) ?? 0 }));

  // Sort giảm dần theo score; tie-break nickname A→Z (khớp rankEntries, deterministic).
  rows.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.nickname.localeCompare(b.nickname)));

  const limit = Number.isInteger(topN) && topN > 0 ? topN : 0;
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}
