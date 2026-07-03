import type { AiTier } from './ai-quota';

/**
 * ============================================================================
 *  SUBSCRIPTION TIER (Phase 2 — nền tảng gói trả phí)
 * ============================================================================
 *  Nguồn sự thật về GÓI (tier) của user. Trước Phase 2, mọi route AI hardcode
 *  tier:'free' (TODO trong chat/generate-practice). Module này thay bằng tier
 *  THẬT tra từ bảng `user_subscriptions`.
 *
 *  Phạm vi phiên này (user chốt 2026-07-04): CHỈ nền tảng tier + gate AI quota
 *  (free=5 lượt/ngày, premium/ultimate=không giới hạn qua DAILY_LIMITS sẵn có).
 *  CHƯA nối cổng thanh toán (VNPay/MoMo) — webhook sẽ gọi grantSubscription khi
 *  làm ở bước sau. Billing: Monthly + Yearly.
 *
 *  ⚠️ THUẦN (pure) — không I/O. "now" được TIÊM vào để unit-test xác định (theo
 *  mẫu economy.ts/gate-exam.ts). Tầng I/O + Supabase nằm ở subscription-store.ts.
 *
 *  ⚠️ GIÁ (priceVnd) là PLACEHOLDER hợp lý cho thị trường VN — CHỐT LẠI với user
 *  TRƯỚC khi nối cổng thanh toán. Giá chỉ là dữ liệu bảng, KHÔNG ảnh hưởng logic
 *  tier/quota nên an toàn để đặt tạm.
 * ============================================================================
 */

/** Gói trả phí (không gồm 'free'). */
export type PaidTier = 'premium' | 'ultimate';

/** Chu kỳ thanh toán. */
export type BillingPeriod = 'monthly' | 'yearly';

export interface Plan {
  tier: PaidTier;
  period: BillingPeriod;
  /** Giá theo VND (placeholder — chốt trước khi nối cổng thanh toán). */
  priceVnd: number;
  /** Số ngày hiệu lực kể từ lúc kích hoạt. */
  durationDays: number;
}

/**
 * Bảng gói cố định ở SERVER. Giá do server quyết (client KHÔNG gửi số tiền),
 * cùng nguyên tắc server-authoritative của economy (§9.1). Yearly ≈ 10 tháng
 * (giảm ~2 tháng) để khuyến khích trả năm.
 */
export const PLANS: Plan[] = [
  { tier: 'premium', period: 'monthly', priceVnd: 99_000, durationDays: 30 },
  { tier: 'premium', period: 'yearly', priceVnd: 990_000, durationDays: 365 },
  { tier: 'ultimate', period: 'monthly', priceVnd: 199_000, durationDays: 30 },
  { tier: 'ultimate', period: 'yearly', priceVnd: 1_990_000, durationDays: 365 },
];

/** Tra 1 gói theo (tier, period). undefined nếu tổ hợp không hợp lệ. */
export function getPlan(tier: PaidTier, period: BillingPeriod): Plan | undefined {
  return PLANS.find((p) => p.tier === tier && p.period === period);
}

export interface SubscriptionRecord {
  tier: PaidTier;
  period: BillingPeriod;
  /** ISO timestamp lúc kích hoạt. */
  startedAt: string;
  /** ISO timestamp hết hạn. */
  expiresAt: string;
}

/**
 * Ngày hết hạn = start + durationDays. start được TIÊM (ISO string) → thuần.
 * Dùng UTC để tránh lệch múi giờ giữa server/DB.
 */
export function computeExpiry(startISO: string, durationDays: number): string {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + durationDays);
  return d.toISOString();
}

/** Gói còn hiệu lực tại thời điểm `nowISO` không (expiresAt > now). */
export function isActive(sub: SubscriptionRecord | null, nowISO: string): boolean {
  if (!sub || !sub.expiresAt) return false;
  return new Date(sub.expiresAt).getTime() > new Date(nowISO).getTime();
}

/**
 * Tier HIỆU LỰC của user tại `nowISO`: tier của gói nếu còn hạn, ngược lại
 * 'free'. Đây là hàm quyết định quyền lợi (nối vào ai-quota qua store).
 */
export function resolveTier(sub: SubscriptionRecord | null, nowISO: string): AiTier {
  return isActive(sub, nowISO) ? sub!.tier : 'free';
}
