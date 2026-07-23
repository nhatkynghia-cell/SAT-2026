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
import { createMomoPayment, isMomoConfigured } from '@/lib/payment-momo';
import { createPayosPayment, isPayosConfigured, generatePayosOrderCode } from '@/lib/payment-payos';
import { createStripeCheckout, isStripeConfigured } from '@/lib/payment-stripe';

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

/** Dựng URL gốc để cổng gọi return/ipn về. Production bắt buộc cấu hình APP_BASE_URL. */
function baseUrl(req: Request): string | null {
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return null;
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
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

    const base = baseUrl(req);
    if (!base) {
      return NextResponse.json(
        { success: false, error: 'Thiếu APP_BASE_URL cho cổng thanh toán.', code: 'APP_BASE_URL_REQUIRED' },
        { status: 503 }
      );
    }
    const returnUrl = `${base}/api/payment/return`;

    // payOS yêu cầu orderCode là SỐ → tách nhánh sớm (order_id = String(orderCode)),
    // KHÔNG dùng orderId UUID chung ở dưới (tránh ghi 2 row).
    if (gateway === 'payos') {
      if (!isPayosConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Cổng payOS đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      const orderCode = generatePayosOrderCode();
      const orderId = String(orderCode);
      const orderInfoPayos = buildOrderInfo(tier, period);
      const createdPayos = await createTransaction({
        userId: user.id,
        orderId,
        gateway,
        tier,
        period,
        amountVnd: plan.priceVnd,
        durationDays: plan.durationDays,
      });
      if (!createdPayos) {
        return NextResponse.json({ success: false, error: 'Không thể khởi tạo giao dịch. Thử lại sau.' }, { status: 500 });
      }
      const payosRes = await createPayosPayment({
        amountVnd: plan.priceVnd,
        orderCode,
        description: orderInfoPayos,
        returnUrl: `${returnUrl}?orderId=${orderId}`,
        cancelUrl: `${base}/upgrade?status=unknown&order=${orderId}`,
      });
      if (!payosRes.ok || !payosRes.payUrl) {
        return NextResponse.json(
          { success: false, error: payosRes.message ?? 'Không tạo được phiên thanh toán payOS.', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, payUrl: payosRes.payUrl, orderId });
    }

    const orderId = generateOrderId();
    const orderInfo = buildOrderInfo(tier, period);

    if (gateway === 'stripe' && !isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng Stripe đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    if (gateway === 'vnpay' && !isVnpayConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng VNPay đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }
    if (gateway === 'momo' && !isMomoConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Cổng MoMo đang được cấu hình. Vui lòng thử lại sau!', code: 'GATEWAY_UNCONFIGURED' },
        { status: 503 }
      );
    }

    // Ghi giao dịch 'pending' SAU khi biết cổng đã cấu hình, để không tạo orphan
    // pending rows khi user bấm nhầm gateway chưa có creds. IPN sau này đối chiếu
    // order_id + amount_vnd đã ghi ở đây.
    const created = await createTransaction({
      userId: user.id,
      orderId,
      gateway,
      tier,
      period,
      amountVnd: plan.priceVnd,
      // A2: ghi luôn số ngày để confirm_payment cấp gói NGUYÊN TỬ (server tra PLANS).
      durationDays: plan.durationDays,
    });
    if (!created) {
      return NextResponse.json({ success: false, error: 'Không thể khởi tạo giao dịch. Thử lại sau.' }, { status: 500 });
    }

    if (gateway === 'stripe') {
      const stripeRes = await createStripeCheckout({
        orderId,
        amountVnd: plan.priceVnd,
        tier,
        period,
        orderInfo,
        // return route đã đọc ?orderId= (nhánh MoMo) → tái dùng nguyên, KHÔNG sửa.
        successUrl: `${base}/api/payment/return?orderId=${orderId}`,
        cancelUrl: `${base}/upgrade?status=unknown&order=${orderId}`,
      });
      if (!stripeRes.ok || !stripeRes.payUrl) {
        return NextResponse.json(
          { success: false, error: stripeRes.message ?? 'Không tạo được phiên thanh toán Stripe.', code: 'GATEWAY_UNCONFIGURED' },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, payUrl: stripeRes.payUrl, orderId });
    }

    if (gateway === 'vnpay') {
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
