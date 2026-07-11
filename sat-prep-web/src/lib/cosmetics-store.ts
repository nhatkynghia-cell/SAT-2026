import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ============================================================================
 *  COSMETICS STORE (Supabase Postgres) — quyền-SỞ-HỮU cosmetic THƯỞNG 'earned'
 * ============================================================================
 *  Bảng `user_cosmetics` (migration_user_cosmetics.sql) lưu ai ĐÃ THẮNG cosmetic
 *  kiểu 'earned' (khung/danh hiệu Nhà Vô Địch Mùa) ở mùa nào. Món VĨNH VIỄN.
 *
 *  Theo mẫu ROOT E / subscription-store: ĐỌC own qua client per-request (RLS
 *  auth.uid()); ĐỌC cross-user + GHI qua admin service-role (cron cấp thưởng là
 *  server-authoritative — client KHÔNG tự phong "vô địch" cho mình).
 *
 *  FAIL-SAFE: bảng chưa tồn tại / lỗi đọc → coi như KHÔNG sở hữu gì (rỗng/false).
 *  Hướng AN TOÀN: lỗi hạ tầng KHÔNG vô tình mở khóa danh vọng, KHÔNG crash cron.
 * ============================================================================
 */

/** Bảng chưa migrate (42P01 Postgres / PGRST205 PostgREST schema cache). */
function isMissingTable(error: { code?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205';
}

/**
 * Cấp một hoặc nhiều cosmetic 'earned' cho user ở mùa `seasonKey` (đường GHI, admin
 * service-role). Gọi bởi cron chốt giải đấu SAU khi xác định top hạng server-side.
 * INSERT ... ON CONFLICT DO NOTHING (ignoreDuplicates) → IDEMPOTENT: cron chạy lại
 * cùng mùa không nhân đôi. Trả true nếu ghi OK (kể cả 0 dòng mới do trùng), false
 * nếu lỗi/pre-migration (cron sẽ bỏ qua an toàn).
 */
export async function grantCosmetics(
  userId: string,
  cosmeticIds: string[],
  seasonKey: string
): Promise<boolean> {
  if (!userId || cosmeticIds.length === 0 || !seasonKey) return false;

  const rows = cosmeticIds.map((cosmetic_id) => ({
    user_id: userId,
    cosmetic_id,
    season_key: seasonKey,
  }));

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_cosmetics')
    .upsert(rows, { onConflict: 'user_id,cosmetic_id,season_key', ignoreDuplicates: true });

  if (error) {
    if (isMissingTable(error)) return false; // pre-migration → cron bỏ qua
    console.error('grantCosmetics: ghi Supabase lỗi:', error.message);
    return false;
  }
  return true;
}

/**
 * Túi cosmetic 'earned' của MỘT user (đường ĐỌC own, RLS). Trả mảng cosmetic_id
 * DISTINCT (gộp mọi mùa đã thắng — món vĩnh viễn). FAIL-SAFE → [] khi lỗi/không có.
 * Dùng cho /api/economy GET để client biết user thực sự sở hữu khung/danh hiệu nào.
 */
export async function getEarnedCosmetics(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_cosmetics')
      .select('cosmetic_id')
      .eq('user_id', userId);

    if (error || !data) return [];
    const set = new Set<string>();
    for (const row of data as Array<{ cosmetic_id: unknown }>) {
      if (typeof row.cosmetic_id === 'string') set.add(row.cosmetic_id);
    }
    return [...set];
  } catch (e) {
    console.error('getEarnedCosmetics lỗi (fail-safe → []):', e);
    return [];
  }
}

/**
 * Túi cosmetic 'earned' của NHIỀU user cùng lúc (đọc SERVICE-ROLE, tránh N+1). Dùng
 * cho leaderboard/giải đấu: cần biết mỗi user đã thắng khung/danh hiệu nào để gán
 * ĐÚNG (danh vọng thật) — KHÔNG đổi thứ hạng. Mẫu batch .in('user_id', ids) như
 * getUsersTierMap. Trả Record<userId, cosmetic_id[]> (distinct).
 *
 * FAIL-SAFE: ids rỗng → {}; bảng chưa tồn tại / lỗi → {} (mọi user coi chưa thắng gì).
 */
export async function getUsersCosmeticsMap(
  userIds: string[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const ids = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) return result;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_cosmetics')
      .select('user_id, cosmetic_id')
      .in('user_id', ids);

    if (error || !data) return result; // fail-safe: {} → mọi user chưa thắng gì
    for (const row of data as Array<{ user_id: unknown; cosmetic_id: unknown }>) {
      const uid = typeof row.user_id === 'string' ? row.user_id : null;
      const cid = typeof row.cosmetic_id === 'string' ? row.cosmetic_id : null;
      if (!uid || !cid) continue;
      (result[uid] ??= []).push(cid);
    }
    // Distinct mỗi user (phòng nhiều mùa cùng món).
    for (const uid of Object.keys(result)) {
      result[uid] = [...new Set(result[uid])];
    }
    return result;
  } catch (e) {
    console.error('getUsersCosmeticsMap lỗi (fail-safe → {}):', e);
    return result;
  }
}
