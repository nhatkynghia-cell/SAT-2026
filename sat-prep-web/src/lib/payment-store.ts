import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PaidTier, BillingPeriod } from './subscription';
import type { PaymentGateway, PaymentTxn, TxnStatus } from './payment';

/**
 * ============================================================================
 *  PAYMENT STORE (Supabase Postgres) — Phase 2 Bước 2
 * ============================================================================
 *  Đọc/ghi giao dịch từ bảng `payment_transactions`.
 *
 *  Theo mẫu ROOT E: ĐỌC qua client per-request (RLS auth.uid()=user_id), GHI qua
 *  admin service-role. Tạo giao dịch (pending) do /api/payment/create; xác nhận
 *  (confirm_payment atomic) do IPN handler SAU khi verify chữ ký cổng.
 *
 *  🔴 FAIL-CLOSED: confirm_payment RPC chưa tồn tại → reason 'confirm_unavailable'
 *  (KHÔNG fallback đọc-sửa-ghi → tránh double-grant / cấp gói khi chưa atomic).
 * ============================================================================
 */

/** Tạo giao dịch mới trạng thái 'pending' (admin insert). Trả false nếu lỗi. */
export async function createTransaction(args: {
  userId: string;
  orderId: string;
  gateway: PaymentGateway;
  tier: PaidTier;
  period: BillingPeriod;
  amountVnd: number;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from('payment_transactions').insert({
    user_id: args.userId,
    order_id: args.orderId,
    gateway: args.gateway,
    tier: args.tier,
    period: args.period,
    amount_vnd: args.amountVnd,
    status: 'pending',
  });

  if (error) {
    console.error('createTransaction: ghi Supabase lỗi:', error.message);
    return false;
  }
  return true;
}

export interface ConfirmOutcome {
  ok: boolean;
  /** 'ok' | 'not_found' | 'amount_mismatch' | 'bad_status' | 'confirm_unavailable' | 'error' */
  reason: string;
  /** true nếu giao dịch ĐÃ 'paid' trước đó (idempotent — route KHÔNG cấp gói lại). */
  alreadyConfirmed: boolean;
  userId?: string;
  tier?: PaidTier;
  period?: BillingPeriod;
}

/**
 * Xác nhận thanh toán ATOMIC (RPC confirm_payment). Gọi bởi IPN handler SAU khi
 * verify chữ ký. amountVnd=0 → bỏ qua kiểm tiền (dùng khi cổng không gửi lại amount).
 *
 * FAIL-CLOSED: RPC chưa có (42883/PGRST202) → { ok:false, reason:'confirm_unavailable' }.
 */
export async function confirmPaymentAtomic(
  orderId: string,
  gatewayTxnId: string,
  amountVnd: number
): Promise<ConfirmOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('confirm_payment', {
    p_order_id: orderId,
    p_gateway_txn_id: gatewayTxnId,
    p_amount: amountVnd,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      console.error('confirmPaymentAtomic: RPC confirm_payment chưa tồn tại (chạy payment_transactions.sql?)');
      return { ok: false, reason: 'confirm_unavailable', alreadyConfirmed: false };
    }
    console.error('confirmPaymentAtomic: RPC lỗi:', error.message);
    return { ok: false, reason: 'error', alreadyConfirmed: false };
  }

  const r = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    alreadyConfirmed?: boolean;
    userId?: string;
    tier?: string;
    period?: string;
  };
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : (r.ok ? 'ok' : 'unknown'),
    alreadyConfirmed: !!r.alreadyConfirmed,
    userId: typeof r.userId === 'string' ? r.userId : undefined,
    tier: r.tier as PaidTier | undefined,
    period: r.period as BillingPeriod | undefined,
  };
}

function mapRow(row: Record<string, unknown>): PaymentTxn {
  return {
    orderId: row.order_id as string,
    gateway: row.gateway as PaymentGateway,
    tier: row.tier as PaidTier,
    period: row.period as BillingPeriod,
    amountVnd: row.amount_vnd as number,
    status: row.status as TxnStatus,
    gatewayTxnId: (row.gateway_txn_id as string | null) ?? null,
    createdAt: row.created_at as string,
    paidAt: (row.paid_at as string | null) ?? null,
  };
}

/** Đọc 1 giao dịch theo order_id (đường ĐỌC per-request, RLS chặn dòng người khác). */
export async function getTransaction(orderId: string): Promise<PaymentTxn | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('order_id, gateway, tier, period, amount_vnd, status, gateway_txn_id, created_at, paid_at')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/** Liệt kê giao dịch CỦA MÌNH (đường ĐỌC, RLS). Mới nhất trước. */
export async function listUserTransactions(userId: string): Promise<PaymentTxn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('order_id, gateway, tier, period, amount_vnd, status, gateway_txn_id, created_at, paid_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapRow);
}
