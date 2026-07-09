import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getReward } from '@/lib/rewards';
import { tryRedeemReward, listRedemptions } from '@/lib/redemption-store';

/**
 * ============================================================================
 *  REDEEM API (server-authoritative) — Phase 2, Bước 3: xu → quà THẬT
 * ============================================================================
 *  GET  → danh sách phiếu đổi quà CỦA MÌNH { redemptions: [...] }.
 *  POST → đổi 1 quà: { rewardId }. Server tra REWARDS lấy GIÁ (client KHÔNG gửi
 *         số xu) → RPC atomic redeem_reward (khóa dòng, trừ xu + ghi phiếu).
 *
 *  🔴 Client chỉ gửi rewardId. Mọi con số (cost) do server quyết từ REWARDS —
 *  không thể đổi quà 50.000 xu bằng cách khai 1 xu. rewardId lạ → 400.
 * ============================================================================
 */

export async function GET() {
  const user = await getCurrentUser();
  // Money-out surface: chốt auth tường minh (không dựa may rủi vào kiểu uuid của RPC).
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });
  }
  const redemptions = await listRedemptions(user.id);
  return NextResponse.json({ redemptions });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    // Money-out surface: chốt auth tường minh (mirror /api/payment/create).
    if (!user.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Cần đăng nhập.' }, { status: 401 });
    }

    // Rate-limit chặt hơn economy (đây là tiền-RA): 10 req/phút/user.
    const rl = rateLimit(`redeem:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rewardId = typeof body?.rewardId === 'string' ? body.rewardId : '';

    // Server tra danh mục → lấy GIÁ. rewardId không hợp lệ → 400 (chống forge).
    const reward = getReward(rewardId);
    if (!reward) {
      return NextResponse.json(
        { success: false, error: 'Phần thưởng không hợp lệ.' },
        { status: 400 }
      );
    }

    const outcome = await tryRedeemReward(user.id, reward.id, reward.name, reward.cost);

    if (!outcome.ok) {
      if (outcome.reason === 'insufficient' || outcome.reason === 'no_row') {
        return NextResponse.json(
          {
            success: false,
            error: 'Bạn không đủ Xu để đổi phần thưởng này.',
            code: 'INSUFFICIENT_COINS',
            coins: outcome.coins,
          },
          { status: 400 }
        );
      }
      if (outcome.reason === 'redeem_unavailable') {
        return NextResponse.json(
          {
            success: false,
            error: 'Tính năng đổi quà đang được nâng cấp. Vui lòng quay lại sau!',
            code: 'REDEEM_UNAVAILABLE',
          },
          { status: 503 }
        );
      }
      // bad_cost / error / unknown
      return NextResponse.json(
        { success: false, error: 'Không thể đổi quà lúc này. Vui lòng thử lại sau.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redemptionId: outcome.redemptionId,
      // Số dư MỚI để client đồng bộ HUD (server-authoritative — không tự trừ).
      coins: outcome.coins,
      reward: { id: reward.id, name: reward.name, cost: reward.cost, kind: reward.kind },
      message: `Đổi thành công: ${reward.name}! Phiếu của bạn đang chờ xử lý.`,
    });
  } catch (error) {
    console.error('Lỗi redeem:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
