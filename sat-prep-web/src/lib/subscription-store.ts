import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AiTier } from './ai-quota';
import {
  resolveTier,
  type BillingPeriod,
  type PaidTier,
  type SubscriptionRecord,
} from './subscription';

/**
 * ============================================================================
 *  SUBSCRIPTION STORE (Supabase Postgres) — Phase 2
 * ============================================================================
 *  Đọc/ghi gói trả phí của user từ bảng `user_subscriptions`.
 *
 *  Theo mẫu ROOT E (2026-07-03): ĐỌC qua client per-request (RLS auth.uid()).
 *  GHI (cấp/gia hạn gói) nay do RPC `confirm_payment` làm ATOMIC cùng lúc lật đơn
 *  pending→paid (migration_a2_atomic_grant.sql) — server-authoritative, client
 *  KHÔNG tự cấp gói. File này chỉ còn đường ĐỌC tier.
 *
 *  FAIL-SAFE: bảng chưa tồn tại / lỗi đọc → coi như KHÔNG có gói → tier 'free'.
 *  Đây là hướng AN TOÀN: lỗi hạ tầng KHÔNG vô tình mở khóa quyền lợi trả phí.
 * ============================================================================
 */

/** Đọc gói còn-hạn-mới-nhất của user (đường ĐỌC, RLS). null nếu không có/lỗi. */
export async function getActiveSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('tier, period, started_at, expires_at')
    .eq('user_id', userId)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    tier: data.tier as PaidTier,
    period: data.period as BillingPeriod,
    startedAt: data.started_at ?? '',
    expiresAt: data.expires_at ?? '',
  };
}

/**
 * Tier HIỆU LỰC của user (nối vào ai-quota). FAIL-SAFE → 'free' khi lỗi/không có.
 * Đây là hàm 2 route AI gọi thay cho hardcode 'free'.
 */
export async function getUserTier(userId: string): Promise<AiTier> {
  try {
    const sub = await getActiveSubscription(userId);
    return resolveTier(sub, new Date().toISOString());
  } catch (e) {
    console.error('getUserTier lỗi (fail-safe → free):', e);
    return 'free';
  }
}

/**
 * Tier HIỆU LỰC của user đọc qua SERVICE-ROLE (bypass RLS). Dùng cho đường KHÔNG
 * có session của user đó — cụ thể báo cáo phụ huynh (phụ huynh không auth, cần
 * biết tier của CON để phân tầng report). FAIL-SAFE → 'free'.
 */
export async function getUserTierAdmin(userId: string): Promise<AiTier> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_subscriptions')
      .select('tier, period, started_at, expires_at')
      .eq('user_id', userId)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return 'free';
    const sub: SubscriptionRecord = {
      tier: data.tier as PaidTier,
      period: data.period as BillingPeriod,
      startedAt: data.started_at ?? '',
      expiresAt: data.expires_at ?? '',
    };
    return resolveTier(sub, new Date().toISOString());
  } catch (e) {
    console.error('getUserTierAdmin lỗi (fail-safe → free):', e);
    return 'free';
  }
}

/**
 * Tier HIỆU LỰC của NHIỀU user cùng lúc (đọc SERVICE-ROLE, tránh N+1). Dùng cho
 * leaderboard/giải đấu: cần biết tier của mọi user để gán khung/danh hiệu cosmetic
 * (danh vọng) — KHÔNG đổi thứ hạng. Mẫu batch .in('user_id', ids) như
 * leaderboard-store.ts. Với mỗi user lấy gói CÒN-HẠN-MỚI-NHẤT rồi resolveTier.
 *
 * FAIL-SAFE: userIds rỗng → {}; bảng chưa tồn tại / lỗi đọc → map RỖNG (mọi user
 * coi 'free') — hướng an toàn: lỗi hạ tầng KHÔNG vô tình mở quyền lợi trả phí.
 * User không có gói → 'free'.
 */
export async function getUsersTierMap(
  userIds: string[]
): Promise<Record<string, 'free' | 'premium' | 'ultimate'>> {
  const result: Record<string, 'free' | 'premium' | 'ultimate'> = {};
  const ids = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) return result;

  try {
    const admin = createAdminClient();
    const nowISO = new Date().toISOString();
    // MỘT query cho MỌI user (order expires_at desc → gói mới-nhất đứng trước).
    const { data, error } = await admin
      .from('user_subscriptions')
      .select('user_id, tier, period, started_at, expires_at')
      .in('user_id', ids)
      .order('expires_at', { ascending: false });

    if (error || !data) return result; // fail-safe: map rỗng → mọi user 'free'

    // Chỉ giữ gói ĐẦU TIÊN gặp mỗi user (đã sort desc → mới-nhất). resolveTier
    // tự trả 'free' nếu gói đã hết hạn.
    for (const row of data as Array<Record<string, unknown>>) {
      const uid = typeof row.user_id === 'string' ? row.user_id : null;
      if (!uid || result[uid] !== undefined) continue;
      const sub: SubscriptionRecord = {
        tier: row.tier as PaidTier,
        period: row.period as BillingPeriod,
        startedAt: (row.started_at as string) ?? '',
        expiresAt: (row.expires_at as string) ?? '',
      };
      result[uid] = resolveTier(sub, nowISO);
    }
    return result;
  } catch (e) {
    console.error('getUsersTierMap lỗi (fail-safe → map rỗng):', e);
    return result;
  }
}

/*
 * (Đã gỡ) grantSubscription() — trước đây là đường GHI cấp/gia hạn gói. Sau khi
 * gộp việc cấp gói vào RPC `confirm_payment` cho ATOMIC (migration_a2_atomic_grant.sql,
 * 2026-07-10), hàm này thành mồ côi (0 caller). Gỡ để tránh dùng nhầm → double-grant
 * ngoài transaction xác nhận đơn. Cấp gói duy nhất qua confirm_payment.
 */
