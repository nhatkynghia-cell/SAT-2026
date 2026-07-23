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

/** IP client (x-forwarded-for đầu tiên) để rate-limit brute-force secret. */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * Verify secret + chống brute-force: CHỈ rate-limit các lần thử THẤT BẠI theo IP
 * (10 lần sai / phút). Secret ĐÚNG không bao giờ chạm limit → admin hợp lệ thao
 * tác thoải mái. Trước đây rate-limit đặt SAU verify (chỉ áp khi đã có secret
 * đúng) nên đoán secret không bị chặn. Trả:
 *   • {ok:true}          — secret đúng, cho qua.
 *   • {ok:false, res}    — sai secret (403) hoặc vượt số lần thử (429).
 */
function verifyAdminOrLimit(req: Request): { ok: true } | { ok: false; res: NextResponse } {
  if (verifyAdminSecret(req.headers.get('x-admin-secret'))) return { ok: true };
  const rl = rateLimit(`admin-auth-fail:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử sai. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      ),
    };
  }
  return { ok: false, res: unauthorized() };
}

export async function GET(req: Request) {
  const auth = verifyAdminOrLimit(req);
  if (!auth.ok) return auth.res;
  const redemptions = await listPendingRedemptions();
  return NextResponse.json({ success: true, redemptions });
}

export async function POST(req: Request) {
  try {
    const auth = verifyAdminOrLimit(req);
    if (!auth.ok) return auth.res;

    // Rate-limit thêm theo hành động (chống bấm dồn khi đã có secret đúng).
    const rl = rateLimit('admin-redemptions', 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON không hợp lệ.' },
        { status: 400 }
      );
    }
    const redemptionId = typeof (body as { redemptionId?: unknown })?.redemptionId === 'string' ? (body as { redemptionId: string }).redemptionId : '';
    const actionValue = (body as { action?: unknown })?.action;
    const action = actionValue === 'fulfill' || actionValue === 'cancel' ? actionValue : '';

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
