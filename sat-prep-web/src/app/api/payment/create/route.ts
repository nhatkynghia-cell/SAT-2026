import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getPlan } from '@/lib/subscription';
import {
  isValidGateway,
  isValidTier,
  isValidPeriod,
  generateOrderId,
  buildOrderInfo,
} from '@/lib/payment';
import { createTransaction } from '@/lib/payment-store';
import { buildVnpayPaymentUrl, isVnpayConfigured } from '@/lib/payment-vnpay';
import { createMomoPayment } from '@/lib/payment-momo';

/**
 * ============================================================================
 *  PAYMENT CREATE — Phase 2 Bước 2
 * ============================================================================
 *  POST { gateway, tier, period } → tạo giao dịch 'pending' + trả { payUrl }.
 *
 *  🔴 Client gửi Ý ĐỊNH (gateway + tier + period). SERVER tra PLANS lấy GIÁ
 *  (client KHÔNG gửi số tiền). Sinh orderId (khóa idempotency), ghi 'pending',
 *  build URL cổng. Việc CẤP GÓI chỉ xảy ra ở IPN (đã verify chữ ký) — KHÔNG ở đây.
 * ============================================================================
 */

/** Dựng URL gốc để cổng gọi return/ipn về. Ưu tiên APP_BASE_URL, fallback origin. */
function baseUrl(req: Request): string {
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Bạn cần đăng nhập để nâng gói.' }, { status: 401 });
    }

    const rl = rateLimit(`payment-create:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { gateway, tier, period } = body ?? {};

    if (!isValidGateway(gateway) || !isValidTier(tier) || !isValidPeriod(period)) {
      return NextResponse.json(
        { success: false, error: 'Thông tin gói hoặc cổng thanh toán không hợp lệ.' },
        { status: 400 }
      );
    }

    // 🔴 SERVER tra giá từ PLANS — client KHÔNG gửi số tiền.
    const plan = getPlan(tier, period);
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Gói không tồn tại.' }, { status: 400 });
    }

    const orderId = generateOrderId();
    const orderInfo = buildOrderInfo(tier, period);
    const base = baseUrl(req);
    const returnUrl = `${base}/api/payment/return`;

    // Ghi giao dịch 'pending' TRƯỚC khi gửi cổng (để IPN đối chiếu order_id + amount).
    const created = await createTransaction({
      userId: user.id,
      orderId,
      gateway,
      tier,
      period,
      amountVnd: plan.priceVnd,
    });
    if (!created) {
      return NextResponse.json({ success: false, error: 'Không thể khởi tạo giao dịch. Thử lại sau.' }, { status: 500 });
    }

    if (gateway === 'vnpay') {
      if (!isVnpayConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Cổng VNPay đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      const payUrl = buildVnpayPaymentUrl({
        orderId,
        amountVnd: plan.priceVnd,
        orderInfo,
        ipAddr: clientIp(req),
        returnUrl,
      });
      return NextResponse.json({ success: true, payUrl, orderId });
    }

    // gateway === 'momo'
    const momo = await createMomoPayment({
      amountVnd: plan.priceVnd,
      orderId,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: `${base}/api/payment/momo-ipn`,
      requestId: orderId,
    });
    if (!momo.ok || !momo.payUrl) {
      return NextResponse.json(
        { success: false, error: momo.message ?? 'Cổng MoMo đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, payUrl: momo.payUrl, orderId });
  } catch (error) {
    console.error('Lỗi payment/create:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
