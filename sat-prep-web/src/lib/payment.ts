import { randomUUID } from 'crypto';
import type { PaidTier, BillingPeriod } from './subscription';

/**
 * ============================================================================
 *  PAYMENT CORE (thuần) — Phase 2 Bước 2: cổng thanh toán VNPay + MoMo
 * ============================================================================
 *  Types + validate + sinh mã giao dịch. KHÔNG I/O, KHÔNG chữ ký (chữ ký ở
 *  payment-vnpay.ts / payment-momo.ts; I/O DB ở payment-store.ts).
 *
 *  🔴 Nguyên tắc money surface (giống §9.1): client gửi Ý ĐỊNH (gateway + tier +
 *  period), SERVER quyết SỐ TIỀN (từ PLANS qua getPlan) + xác nhận giao dịch chỉ
 *  qua IPN server-to-server đã verify chữ ký. Client KHÔNG gửi số tiền.
 * ============================================================================
 */

/** Cổng thanh toán hỗ trợ. */
export type PaymentGateway = 'vnpay' | 'momo';

/** Trạng thái 1 giao dịch (khớp CHECK của bảng payment_transactions). */
export type TxnStatus = 'pending' | 'paid' | 'failed' | 'expired';

/** 1 bản ghi giao dịch (đọc lại từ payment_transactions). */
export interface PaymentTxn {
  orderId: string;
  gateway: PaymentGateway;
  tier: PaidTier;
  period: BillingPeriod;
  amountVnd: number;
  status: TxnStatus;
  gatewayTxnId: string | null;
  createdAt: string;
  paidAt: string | null;
}

const VALID_GATEWAYS: readonly PaymentGateway[] = ['vnpay', 'momo'];
const VALID_TIERS: readonly PaidTier[] = ['premium', 'ultimate'];
const VALID_PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

export function isValidGateway(g: unknown): g is PaymentGateway {
  return typeof g === 'string' && VALID_GATEWAYS.includes(g as PaymentGateway);
}
export function isValidTier(t: unknown): t is PaidTier {
  return typeof t === 'string' && VALID_TIERS.includes(t as PaidTier);
}
export function isValidPeriod(p: unknown): p is BillingPeriod {
  return typeof p === 'string' && VALID_PERIODS.includes(p as BillingPeriod);
}

/**
 * Sinh mã giao dịch merchant (vnp_TxnRef / MoMo orderId). Duy nhất, không đoán
 * được, prefix để dễ nhận diện trong log/đối soát. Dùng làm khóa idempotency
 * (cột order_id UNIQUE) → 1 lần "create" = 1 order = 1 lần cấp gói tối đa.
 */
export function generateOrderId(): string {
  return `SAT-${randomUUID()}`;
}

/**
 * Nội dung mô tả thanh toán (VNPay yêu cầu tiếng Việt KHÔNG dấu; giữ ASCII cho
 * an toàn với cả 2 cổng). Không nhúng dữ liệu client — dựng từ tier/period server.
 */
export function buildOrderInfo(tier: PaidTier, period: BillingPeriod): string {
  const tierLabel = tier === 'ultimate' ? 'Ultimate' : 'Premium';
  const periodLabel = period === 'yearly' ? 'nam' : 'thang';
  return `Nang cap goi ${tierLabel} ${periodLabel} - Gia su AI SAT`;
}
