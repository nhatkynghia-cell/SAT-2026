import { NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  listPendingRedemptions,
  fulfillRedemption,
  cancelRedemption,
} from '@/lib/admin-fulfillment-store';

/**
 * ============================================================================
 *  ADMIN REDEMPTIONS API — Phase 2: xử lý hàng đợi đổi quà (shared-secret)
 * ============================================================================
 *  Bảo vệ bằng shared-secret (header `x-admin-secret`, so timing-safe với ENV
 *  ADMIN_SECRET — admin-auth.ts). App CHƯA có role system → đây là biện pháp NHẸ
 *  cho beta. FAIL-CLOSED: ENV chưa set → mọi request 403.
 *
 *  GET  → danh sách phiếu 'pending' toàn hệ thống (FIFO), cho admin xử lý.
 *  POST → { redemptionId, action: 'fulfill' | 'cancel' }.
 *         fulfill: đánh dấu đã giao (KHÔNG hoàn xu).
 *         cancel : hủy + HOÀN xu (atomic, idempotent chống double-refund).
 *
 *  🔴 Đường GHI cross-user chạy service-role trong store — CHỈ sau khi verify
 *  secret. Số tiền (hoàn xu) do RPC atomic quyết từ cost_coins của phiếu; client
 *  admin KHÔNG gửi số xu.
 * ============================================================================
 */

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Không có quyền truy cập.' }, { status: 403 });
}

export async function GET(req: Request) {
  if (!verifyAdminSecret(req.headers.get('x-admin-secret'))) return unauthorized();
  const redemptions = await listPendingRedemptions();
  return NextResponse.json({ success: true, redemptions });
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-admin-secret');
    if (!verifyAdminSecret(secret)) return unauthorized();

    // Rate-limit theo secret (không có user id ở đường admin) — chống bấm dồn.
    const rl = rateLimit('admin-redemptions', 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await req.json();
    const redemptionId = typeof body?.redemptionId === 'string' ? body.redemptionId : '';
    const action = body?.action === 'fulfill' || body?.action === 'cancel' ? body.action : '';

    if (!redemptionId || !action) {
      return NextResponse.json(
        { success: false, error: 'Thiếu redemptionId hoặc action (fulfill/cancel).' },
        { status: 400 }
      );
    }

    const outcome =
      action === 'fulfill'
        ? await fulfillRedemption(redemptionId)
        : await cancelRedemption(redemptionId);

    if (!outcome.ok) {
      if (outcome.reason === 'unavailable') {
        return NextResponse.json(
          { success: false, error: 'Tính năng đang được nâng cấp. Vui lòng quay lại sau!', code: 'UNAVAILABLE' },
          { status: 503 }
        );
      }
      if (outcome.reason === 'not_found') {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy phiếu.', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      if (outcome.reason === 'bad_status') {
        return NextResponse.json(
          {
            success: false,
            error: 'Phiếu không ở trạng thái xử lý được (đã giao hoặc đã hủy).',
            code: 'BAD_STATUS',
            status: outcome.status,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Không thể xử lý phiếu lúc này.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redemptionId,
      action,
      status: outcome.status,
      // Với cancel: số dư MỚI của user sau hoàn xu (server-authoritative).
      coins: outcome.coins,
      // 'already' = idempotent (đã ở trạng thái đích), vẫn coi là thành công.
      idempotent: outcome.reason === 'already',
    });
  } catch (error) {
    console.error('Lỗi admin redemptions:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
