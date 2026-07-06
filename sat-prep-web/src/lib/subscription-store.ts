import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AiTier } from './ai-quota';
import {
  computeExpiry,
  getPlan,
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
 *  Theo mẫu ROOT E (2026-07-03): ĐỌC qua client per-request (RLS auth.uid()),
 *  GHI qua admin service-role (grantSubscription do webhook thanh toán gọi —
 *  server-authoritative, client KHÔNG tự cấp gói cho mình).
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
 * Cấp/ gia hạn gói cho user (đường GHI, admin service-role). Được gọi bởi
 * webhook thanh toán SAU khi xác nhận giao dịch server-side (chưa nối phiên này).
 * Server tra PLANS để lấy durationDays + tính expiresAt — client KHÔNG gửi ngày
 * hết hạn hay số tiền. Trả về bản ghi đã ghi, hoặc null nếu gói không hợp lệ/lỗi.
 */
export async function grantSubscription(
  userId: string,
  tier: PaidTier,
  period: BillingPeriod
): Promise<SubscriptionRecord | null> {
  const plan = getPlan(tier, period);
  if (!plan) {
    console.error(`grantSubscription: gói không hợp lệ (${tier}/${period})`);
    return null;
  }

  const startedAt = new Date().toISOString();
  const expiresAt = computeExpiry(startedAt, plan.durationDays);

  const admin = createAdminClient();
  const { error } = await admin.from('user_subscriptions').insert({
    user_id: userId,
    tier,
    period,
    started_at: startedAt,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('grantSubscription: ghi Supabase lỗi:', error.message);
    return null;
  }

  return { tier, period, startedAt, expiresAt };
}
