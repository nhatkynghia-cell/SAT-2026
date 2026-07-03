import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RedemptionRecord, RedemptionStatus } from './rewards';

/**
 * ============================================================================
 *  REDEMPTION STORE (Supabase Postgres) — Phase 2, Bước 3: xu → quà THẬT
 * ============================================================================
 *  Đọc/ghi phiếu đổi quà từ bảng `reward_redemptions`.
 *
 *  Theo mẫu ROOT E: ĐỌC qua client per-request (RLS auth.uid()=user_id),
 *  GHI qua RPC atomic `redeem_reward` gọi bằng admin service-role (khóa dòng
 *  user_economy → trừ xu + tạo phiếu trong 1 transaction). Client KHÔNG tự trừ
 *  xu / tạo phiếu — /api/redeem xác thực rồi gọi hàm này.
 *
 *  🔴 FAIL-CLOSED (KHÁC PvP fail-safe): nếu RPC chưa tồn tại (SQL chưa chạy) →
 *  TỪ CHỐI đổi (reason 'redeem_unavailable'), KHÔNG fallback đường đọc-sửa-ghi
 *  (sẽ hở race + half-write vì redemption vừa trừ xu vừa ghi phiếu quà thật).
 * ============================================================================
 */

export interface RedeemOutcome {
  ok: boolean;
  /** 'ok' | 'insufficient' | 'no_row' | 'bad_cost' | 'redeem_unavailable' | 'error' */
  reason: string;
  /** Số dư xu MỚI sau khi trừ (chỉ có nghĩa khi ok=true, hoặc số dư hiện tại khi insufficient). */
  coins?: number;
  /** id phiếu vừa tạo (khi ok=true). */
  redemptionId?: string;
}

/**
 * Đổi 1 phần thưởng ATOMIC. Server truyền `cost` từ REWARDS (rewards.ts) — client
 * KHÔNG gửi số xu. Gọi RPC redeem_reward (khóa dòng, trừ xu + ghi phiếu).
 *
 * FAIL-CLOSED: RPC chưa có (42883/PGRST202) → { ok:false, reason:'redeem_unavailable' }.
 */
export async function tryRedeemReward(
  userId: string,
  rewardId: string,
  rewardName: string,
  cost: number
): Promise<RedeemOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('redeem_reward', {
    p_user_id: userId,
    p_reward_id: rewardId,
    p_reward_name: rewardName,
    p_cost: cost,
  });

  if (error) {
    // RPC chưa tồn tại (SQL chưa chạy) → fail-closed, KHÔNG fallback.
    if (error.code === '42883' || error.code === 'PGRST202') {
      console.error('tryRedeemReward: RPC redeem_reward chưa tồn tại (chạy reward_redemptions.sql?)');
      return { ok: false, reason: 'redeem_unavailable' };
    }
    console.error('tryRedeemReward: RPC lỗi:', error.message);
    return { ok: false, reason: 'error' };
  }

  const r = (data ?? {}) as Partial<RedeemOutcome> & { ok?: boolean; reason?: string };
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : 'unknown',
    coins: typeof r.coins === 'number' ? r.coins : undefined,
    redemptionId: typeof r.redemptionId === 'string' ? r.redemptionId : undefined,
  };
}

/** Liệt kê phiếu đổi quà CỦA MÌNH (đường ĐỌC, RLS). Mới nhất trước. */
export async function listRedemptions(userId: string): Promise<RedemptionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('id, reward_id, reward_name, cost_coins, status, created_at, fulfilled_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    rewardId: row.reward_id as string,
    rewardName: row.reward_name as string,
    costCoins: row.cost_coins as number,
    status: row.status as RedemptionStatus,
    createdAt: row.created_at as string,
    fulfilledAt: (row.fulfilled_at as string | null) ?? null,
  }));
}
