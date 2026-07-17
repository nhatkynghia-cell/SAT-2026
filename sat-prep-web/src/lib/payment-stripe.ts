import Stripe from 'stripe';

/**
 * ============================================================================
 *  STRIPE PAYMENT — Checkout Session + Webhook (thay VNPay/MoMo)
 * ============================================================================
 *  Dùng Stripe Checkout (redirect) + webhook checkout.session.completed để cấp
 *  gói. Tái dùng NGUYÊN tầng business logic hiện có: order (payment_transactions),
 *  subscription (user_subscriptions), RPC confirm_payment (cấp gói nguyên tử A2).
 *
 *  🔴 VND là ZERO-DECIMAL currency ở Stripe → unit_amount = số VND thô (KHÔNG ×100)
 *  và session.amount_total cũng = số VND → khớp thẳng amount_vnd trong DB. Nhờ vậy
 *  confirm_payment kiểm tiền GIỮ NGUYÊN, không cần sửa RPC.
 *
 *  🔴 Money surface (giống VNPay/MoMo): client gửi Ý ĐỊNH (tier + period), SERVER
 *  quyết SỐ TIỀN (từ PLANS qua getPlan). Cấp gói CHỈ ở webhook server-to-server đã
 *  verify chữ ký — KHÔNG ở success_url (browser giả mạo được).
 *
 *  Env (server-only): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Thiếu →
 *  getStripeClient ném / isStripeConfigured=false → route trả 503 (cổng chưa cấu hình).
 * ============================================================================
 */

let _client: Stripe | null = null;

/** Client Stripe singleton (đọc env server-only). Ném nếu thiếu STRIPE_SECRET_KEY. */
export function getStripeClient(): Stripe {
  if (_client) return _client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe chưa cấu hình (thiếu STRIPE_SECRET_KEY).');
  }

  // Không ghim apiVersion → dùng mặc định pin theo SDK (tránh lệch type khi nâng SDK).
  _client = new Stripe(key);
  return _client;
}

/** Cổng đã cấu hình chưa (route dùng để trả 503 sớm, không ném). Webhook cần cả 2 key. */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

export interface StripeCheckoutResult {
  ok: boolean;
  payUrl?: string;
  message?: string;
}

/**
 * Tạo Checkout Session (mode 'payment'). Trả payUrl để redirect browser (khớp
 * window.location.assign hiện có ở /upgrade). orderId gắn vào client_reference_id
 * + metadata để webhook map ngược về đơn (khóa idempotency order_id UNIQUE).
 *
 * amountVnd là VND thô → unit_amount = amountVnd (VND zero-decimal, KHÔNG ×100).
 */
export async function createStripeCheckout(args: {
  orderId: string;
  amountVnd: number;
  tier: string;
  period: string;
  orderInfo: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutResult> {
  if (!isStripeConfigured()) {
    return { ok: false, message: 'Stripe chưa cấu hình.' };
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'vnd',
          unit_amount: args.amountVnd, // 🔴 KHÔNG ×100 (VND zero-decimal)
          product_data: { name: args.orderInfo },
        },
      },
    ],
    // orderId ở CẢ metadata lẫn client_reference_id → webhook đọc chắc chắn.
    client_reference_id: args.orderId,
    metadata: { orderId: args.orderId, tier: args.tier, period: args.period },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  if (!session.url) {
    return { ok: false, message: 'Stripe không trả về URL thanh toán.' };
  }
  return { ok: true, payUrl: session.url };
}

/**
 * Verify chữ ký webhook Stripe. Ném nếu chữ ký sai (route bắt → 400, KHÔNG cấp gói).
 * Trả Stripe.Event đã parse. rawBody PHẢI là raw string (req.text()) — parse JSON
 * trước sẽ làm sai chữ ký HMAC.
 */
export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Stripe webhook chưa cấu hình (thiếu STRIPE_WEBHOOK_SECRET).');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
