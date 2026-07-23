import type { AiTier } from './ai-quota';

/**
 * ============================================================================
 *  SUBSCRIPTION TIER (Phase 2 — nền tảng gói trả phí)
 * ============================================================================
 *  Nguồn sự thật về GÓI (tier) của user. Trước Phase 2, mọi route AI hardcode
 *  tier:'free'. Nay chat/route.ts và generate-practice/route.ts đã tra tier THẬT
 *  qua getUserTier() (fail-safe → 'free' khi lỗi/không có gói) — module này giữ
 *  logic thuần tier + gate quota, đọc từ bảng `user_subscriptions`.
 *
 *  Phạm vi: nền tảng tier + gate AI quota. Cổng thanh toán Stripe đã nối:
 *  việc cấp/gia hạn gói do RPC `confirm_payment` làm ATOMIC cùng lúc xác nhận đơn
 *  (migration_a2_atomic_grant.sql), KHÔNG qua hàm grant riêng. Billing:
 *  Monthly/Quarterly/Semiannual/Yearly.
 *
 *  ⚠️ THUẦN (pure) — không I/O. "now" được TIÊM vào để unit-test xác định (theo
 *  mẫu economy.ts/gate-exam.ts). Tầng I/O + Supabase nằm ở subscription-store.ts.
 *
 *  ⚠️ GIÁ (priceVnd) = GIÁ NIÊM YẾT (list price) đã CHỐT với user 2026-07-06,
 *  mức "Premium-elite" — neo cao cho tệp học sinh du học có điều kiện + chừa
 *  headroom cho affiliate/KOL chiết khấu 30-40% (buyer nhập mã KOL → thực thu
 *  ~65% list, vẫn lãi vì sàn chi phí AI thấp). Giá chỉ là dữ liệu bảng, KHÔNG
 *  ảnh hưởng logic tier/quota. Chốt giá cuối xem TODO_USER.md.
 *
 *  KHÁC BIỆT GÓI: cả Premium & Ultimate đều ∞ AI (DAILY_LIMITS KHÔNG đổi) → phân
 *  tầng bằng RPG (hệ số xu, đề độc quyền) + chương trình học (skill-tree/adaptive/
 *  thi thật) + mentor (report 90d, model AI xịn), KHÔNG bằng quota AI.
 *
 *  ⏳ Affiliate/coupon (referral tracking + áp discount ở payment/create + payout
 *  hoa hồng) là Wave 2, cần migration DB — CHƯA xây. payment/create hiện chốt
 *  giá cứng từ PLANS, chưa nhận coupon.
 * ============================================================================
 */

/** Gói trả phí (không gồm 'free'). */
export type PaidTier = 'premium' | 'ultimate';

/**
 * HỆ SỐ NHÂN XU theo gói (phễu RPG 2026-07-06): người mua gói kiếm xu nhanh hơn
 * cho CÙNG một câu đúng → lên đồ/pet/tháp nhanh hơn (cảm giác "đáng tiền"), mà xu
 * vẫn kiếm từ HỌC THẬT. CHỈ nhân xu (coins) — KHÔNG nhân XP. Áp ĐỒNG BỘ ở mọi
 * faucet server (grade/exams-grade/vocab/quest/spin/pvp) qua economy.ts.
 * ⚠️ Xu đổi được quà thật (reward-to-real) → paid chạm ngưỡng đổi quà nhanh hơn
 * (chủ ý, phần "tự hoàn vốn"); admin vẫn fulfill thủ công nên không rủi ro faucet.
 */
export const TIER_COIN_MULTIPLIER: Record<AiTier, number> = {
  free: 1,
  premium: 1.5,
  ultimate: 2,
};

/**
 * Cap PvP/trận-đấu mỗi ngày theo gói (Wave 2 — 2026-07-21). Free ít hơn để giảm
 * farm xu lặp trên account miễn phí; premium/ultimate nhiều hơn (đã trả tiền).
 * Route /api/economy action 'pvp' kẹp thêm cap này TRƯỚC khi tiêu suất trận,
 * song song với PVP_MAX_FIGHTS_PER_DAY (cap tuyệt đối) — lấy MIN hai giá trị.
 * Thuần, không I/O; route tự tra tier rồi áp.
 */
export const TIER_PVP_CAP_PER_DAY: Record<AiTier, number> = {
  free: 3,
  premium: 10,
  ultimate: 20,
};

/**
 * Cap số tầng Tháp Vô Tận mỗi ngày theo gói (Wave 2). Free bị giới hạn để tạo
 * thói quen ngắn; paid leo thoải mái. Route /api/tower/question kẹp theo floor
 * đã leo trong ngày (chưa có cột DB → tạm chỉ ghi nhận ý định; khi có cột tower_*
 * sẽ enforce thật). Giá trị dùng cho UI hiển thị cap + route gate khi có DB.
 */
export const TIER_TOWER_CAP_PER_DAY: Record<AiTier, number> = {
  free: 5,
  premium: 20,
  ultimate: 50,
};

/** Chu kỳ thanh toán. */
export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

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
  { tier: 'premium', period: 'quarterly', priceVnd: 1_350_000, durationDays: 90 },
  { tier: 'premium', period: 'semiannual', priceVnd: 2_400_000, durationDays: 180 },
  { tier: 'premium', period: 'yearly', priceVnd: 3_990_000, durationDays: 365 },
  { tier: 'ultimate', period: 'monthly', priceVnd: 990_000, durationDays: 30 },
  { tier: 'ultimate', period: 'quarterly', priceVnd: 2_670_000, durationDays: 90 },
  { tier: 'ultimate', period: 'semiannual', priceVnd: 4_740_000, durationDays: 180 },
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
