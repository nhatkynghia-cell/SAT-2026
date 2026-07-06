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
 *  ⚠️ GIÁ (priceVnd) = GIÁ NIÊM YẾT (list price) đã CHỐT với user 2026-07-06,
 *  mức "Premium-elite" — neo cao cho tệp học sinh du học có điều kiện + chừa
 *  headroom cho affiliate/KOL chiết khấu 30-40% (buyer nhập mã KOL → thực thu
 *  ~65% list, vẫn lãi vì sàn chi phí AI thấp). Giá chỉ là dữ liệu bảng, KHÔNG
 *  ảnh hưởng logic tier/quota.
 *
 *  KHÁC BIỆT GÓI (user chốt 2026-07-06): cả Premium & Ultimate đều ∞ AI
 *  (DAILY_LIMITS KHÔNG đổi) → phân tầng bằng RPG (hệ số xu, đề độc quyền) +
 *  chương trình học (skill-tree/adaptive/thi thật) + mentor (report 90d, model
 *  AI xịn), KHÔNG bằng quota AI. Xem CLgia.md ma trận phễu.
 *
 *  ⏳ Affiliate/coupon (referral tracking + áp discount ở payment/create + payout
 *  hoa hồng) là Wave 2, cần migration DB — CHƯA xây. payment/create hiện chốt
 *  giá cứng từ PLANS, chưa nhận coupon.
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
 * cùng nguyên tắc server-authoritative của economy (§9.1). Yearly ≈ 8 tháng
 * (giảm ~4 tháng) để khuyến khích trả năm.
 */
export const PLANS: Plan[] = [
  { tier: 'premium', period: 'monthly', priceVnd: 499_000, durationDays: 30 },
  { tier: 'premium', period: 'yearly', priceVnd: 3_990_000, durationDays: 365 },
  { tier: 'ultimate', period: 'monthly', priceVnd: 990_000, durationDays: 30 },
  { tier: 'ultimate', period: 'yearly', priceVnd: 7_990_000, durationDays: 365 },
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
