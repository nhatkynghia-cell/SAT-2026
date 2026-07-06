import { createAdminClient } from '@/lib/supabase/admin';
import type { RedemptionRecord, RedemptionStatus } from './rewards';

/**
 * ============================================================================
 *  ADMIN FULFILLMENT STORE — Phase 2: xử lý phiếu đổi quà (pending→fulfilled)
 * ============================================================================
 *  Đường ADMIN (service-role) đọc/ghi CROSS-USER hàng đợi phiếu đổi quà. Gom
 *  TẤT CẢ truy cập cross-user vào 1 file auditable (giống parent-report-store).
 *
 *  Admin xác thực bằng shared-secret (admin-auth.ts) ở route → store này chỉ
 *  chạy sau khi route đã verify secret. Bảng `reward_redemptions` RLS CHỈ SELECT
 *  own → authenticated KHÔNG đọc phiếu người khác; admin dùng service-role
 *  (bypass RLS) để thấy toàn hàng đợi + gọi RPC ghi.
 *
 *  🔴 FAIL-CLOSED (như redemption-store): fulfill/cancel gọi RPC atomic. Cancel
 *  HOÀN xu → phải atomic (khóa dòng), KHÔNG fallback non-atomic. RPC chưa tồn
 *  tại (SQL chưa chạy) → trả reason 'unavailable', route trả 503.
 * ============================================================================
 */

export interface AdminRedemptionRecord extends RedemptionRecord {
  /** Chủ phiếu — CHỈ đường admin mới thấy (đường user không cần, đã scope own). */
  userId: string;
}

export interface FulfillOutcome {
  ok: boolean;
  /** 'ok' | 'not_found' | 'bad_status' | 'already' | 'unavailable' | 'error' */
  reason: string;
  status?: RedemptionStatus;
  /** Số dư MỚI sau khi hoàn xu (chỉ có nghĩa với cancel ok=true). */
  coins?: number;
}

const RPC_MISSING = new Set(['42883', 'PGRST202']);

/** Liệt kê phiếu đang chờ xử lý (toàn hệ thống), cũ nhất trước (FIFO hàng đợi). */
export async function listPendingRedemptions(
  limit = 100
): Promise<AdminRedemptionRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('reward_redemptions')
    .select('id, user_id, reward_id, reward_name, cost_coins, status, created_at, fulfilled_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    rewardId: row.reward_id as string,
    rewardName: row.reward_name as string,
    costCoins: row.cost_coins as number,
    status: row.status as RedemptionStatus,
    createdAt: row.created_at as string,
    fulfilledAt: (row.fulfilled_at as string | null) ?? null,
  }));
}

/**
 * Đánh dấu phiếu 'pending' → 'fulfilled' (admin đã cấp voucher/tài liệu/gói).
 * Idempotent: gọi lại phiếu đã fulfilled → reason 'already' (KHÔNG lỗi).
 * KHÔNG hoàn xu (quà đã giao).
 */
export async function fulfillRedemption(redemptionId: string): Promise<FulfillOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('fulfill_redemption', {
    p_redemption_id: redemptionId,
  });

  if (error) {
    if (RPC_MISSING.has(error.code ?? '')) {
      console.error('fulfillRedemption: RPC chưa tồn tại (chạy reward_redemptions.sql?)');
      return { ok: false, reason: 'unavailable' };
    }
    console.error('fulfillRedemption: RPC lỗi:', error.message);
    return { ok: false, reason: 'error' };
  }
  return normalize(data);
}

/**
 * Hủy phiếu 'pending' → 'cancelled' + HOÀN xu về user (admin không giao được).
 * Atomic (RPC khóa dòng): hoàn xu + đổi status trong 1 transaction. Idempotent:
 * phiếu đã cancelled → reason 'already', KHÔNG hoàn xu lần 2.
 */
export async function cancelRedemption(redemptionId: string): Promise<FulfillOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('cancel_redemption', {
    p_redemption_id: redemptionId,
  });

  if (error) {
    if (RPC_MISSING.has(error.code ?? '')) {
      console.error('cancelRedemption: RPC chưa tồn tại (chạy reward_redemptions.sql?)');
      return { ok: false, reason: 'unavailable' };
    }
    console.error('cancelRedemption: RPC lỗi:', error.message);
    return { ok: false, reason: 'error' };
  }
  return normalize(data);
}

function normalize(data: unknown): FulfillOutcome {
  const r = (data ?? {}) as Partial<FulfillOutcome> & { ok?: boolean; reason?: string };
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : 'unknown',
    status: typeof r.status === 'string' ? (r.status as RedemptionStatus) : undefined,
    coins: typeof r.coins === 'number' ? r.coins : undefined,
  };
}
