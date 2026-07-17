import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { verifyStripeWebhook, isStripeConfigured } from '@/lib/payment-stripe';
import { confirmPaymentAtomic } from '@/lib/payment-store';

/**
 * ============================================================================
 *  STRIPE WEBHOOK — server-to-server, AUTHORITATIVE (thay vai trò IPN)
 * ============================================================================
 *  Stripe gọi POST sau khi user thanh toán. ĐÂY là nguồn sự thật để cấp gói
 *  (KHÔNG phải success_url — browser giả mạo được).
 *
 *  Luồng: đọc RAW body → verify chữ ký HMAC (STRIPE_WEBHOOK_SECRET) →
 *  checkout.session.completed + payment_status='paid' → confirm_payment ATOMIC
 *  (lật paid + CẤP GÓI nguyên tử — A2). Idempotency do confirm_payment lo (retry
 *  Stripe → alreadyConfirmed → KHÔNG cấp lần 2).
 *
 *  🔴 VND zero-decimal → session.amount_total = số VND → khớp thẳng amount_vnd.
 *  🔴 Route này PHẢI nằm trong PUBLIC_PREFIXES (middleware) — Stripe không gửi
 *     cookie session, nếu không sẽ bị chặn 401 trước khi tới handler.
 * ============================================================================
 */

export async function POST(req: Request) {
  try {
    if (!isStripeConfigured()) {
      // Cổng chưa cấu hình → báo lỗi để Stripe retry sau khi set env.
      return NextResponse.json({ message: 'Stripe chưa cấu hình' }, { status: 503 });
    }

    const sig = req.headers.get('stripe-signature') ?? '';
    // 🔴 RAW body BẮT BUỘC cho verify chữ ký (parse JSON trước sẽ làm sai HMAC).
    // App Router: Request.text() cho raw body, KHÔNG cần disable bodyParser như Pages Router.
    const rawBody = await req.text();

    // 1) Verify chữ ký — sai → từ chối, KHÔNG xử lý.
    let event: Stripe.Event;
    try {
      event = verifyStripeWebhook(rawBody, sig);
    } catch {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    // 2) Chỉ xử lý checkout.session.completed; event khác → 200 ack (bỏ qua).
    if (event.type !== 'checkout.session.completed') {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // 3) Chỉ cấp khi ĐÃ thật sự trả tiền (async payment method có thể 'unpaid'/'no_payment_required').
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    // 4) Map ngược về đơn: orderId ở metadata (ưu tiên) hoặc client_reference_id.
    const orderId = session.metadata?.orderId ?? session.client_reference_id ?? '';
    const gatewayTxnId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? '';
    const amountVnd = Number(session.amount_total ?? 0); // VND zero-decimal → = priceVnd

    // 5) Xác nhận atomic (kiểm tiền + idempotent + cấp gói nguyên tử A2).
    const outcome = await confirmPaymentAtomic(orderId, gatewayTxnId, amountVnd);

    // Lỗi tạm (confirm_unavailable / bad_status / error) → 500 để Stripe retry.
    // amount_mismatch / not_found → 200 (không nên retry — dữ liệu sẽ không đổi).
    if (!outcome.ok && outcome.reason !== 'amount_mismatch' && outcome.reason !== 'not_found') {
      return NextResponse.json({ message: 'Confirm failed, retry' }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Lỗi stripe-webhook:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
