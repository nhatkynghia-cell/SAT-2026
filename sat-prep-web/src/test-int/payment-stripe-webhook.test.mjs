/**
 * INTEGRATION — /api/payment/stripe-webhook (bề mặt tiền QUAN TRỌNG NHẤT: cấp gói
 * trả phí thật). Chạy THẬT route + payment-store + confirm_payment RPC (model
 * atomic) + verify chữ ký Stripe (HMAC-SHA256 thật qua SDK — KHÔNG stub).
 *
 * Bất biến sống-còn (đối xứng payment-ipn.test.mjs):
 *   • CHỈ webhook đã verify chữ ký + payment_status='paid' mới cấp gói.
 *   • Chữ ký sai → 400, KHÔNG cấp (chống giả mạo callback).
 *   • IDEMPOTENT: Stripe retry / gửi lại → alreadyConfirmed → KHÔNG double-grant.
 *   • Sai số tiền (amount_total lệch amount_vnd) → amount_mismatch → KHÔNG cấp.
 *   • Cổng chưa cấu hình (thiếu env) → 503, KHÔNG cấp.
 *   • VND zero-decimal → amount_total = số VND → khớp thẳng amount_vnd.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetDb, seed, getRows, readRes } from './harness.mjs';

// ⚠️ Stripe creds test PHẢI set TRƯỚC khi import route (getStripeClient cache
// singleton _client ở lần gọi đầu). node:test chạy mỗi FILE 1 process riêng →
// env set ở đây KHÔNG rò sang payment-create/payment-ipn test.
const STRIPE_SECRET = 'sk_test_dummy_key';
const WEBHOOK_SECRET = 'whsec_test_dummy_secret';
process.env.STRIPE_SECRET_KEY = STRIPE_SECRET;
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

const { POST: stripeWebhook } = await import('@/app/api/payment/stripe-webhook/route');

/**
 * Ký body webhook theo đúng format Stripe: header `t=<ts>,v1=<hmac_sha256(secret,
 * "<ts>.<rawBody>")>`. constructEvent verify header này bằng SDK thật.
 */
function signStripe(rawBody, secret = WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex');
  return `t=${ts},v1=${sig}`;
}

function checkoutSession(orderId, overrides = {}) {
  return {
    id: `cs_${orderId}`,
    object: 'checkout.session',
    payment_status: 'paid',
    client_reference_id: orderId,
    metadata: { orderId },
    payment_intent: `pi_${orderId}`,
    amount_total: 990000,
    ...overrides,
  };
}

function eventBody(type, session) {
  return JSON.stringify({ id: `evt_${session.id}`, object: 'event', type, data: { object: session } });
}

/** Build POST Request webhook. sign=false → chữ ký giả (401/400). */
function webhookReq(rawBody, { sign = true } = {}) {
  return new Request('http://t/stripe-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': sign ? signStripe(rawBody) : 't=123,v1=forgeddeadbeef',
    },
    body: rawBody,
  });
}

function seedPendingTxn(orderId, opts = {}) {
  seed('payment_transactions', {
    user_id: opts.userId ?? 'pay-user', order_id: orderId, gateway: 'stripe',
    tier: opts.tier ?? 'premium', period: opts.period ?? 'yearly',
    amount_vnd: opts.amountVnd ?? 990000, status: 'pending',
    duration_days: opts.durationDays === undefined ? 365 : opts.durationDays,
    gateway_txn_id: null, created_at: '2026-07-01T00:00:00Z', paid_at: null,
  });
}

test('stripe-webhook: chữ ký hợp lệ + paid → 200, lật paid + CẤP GÓI', async () => {
  resetDb();
  seedPendingTxn('SW-1', { userId: 'u-sw', tier: 'ultimate', period: 'monthly', amountVnd: 990000 });

  const raw = eventBody('checkout.session.completed', checkoutSession('SW-1', { amount_total: 990000 }));
  const res = await stripeWebhook(webhookReq(raw));
  assert.equal(res.status, 200, 'nhận webhook OK → 200');

  assert.equal(getRows('payment_transactions')[0].status, 'paid');
  const subs = getRows('user_subscriptions');
  assert.equal(subs.length, 1, 'đã cấp 1 gói');
  assert.equal(subs[0].user_id, 'u-sw');
  assert.equal(subs[0].tier, 'ultimate');
  assert.equal(subs[0].period, 'monthly');
});

test('stripe-webhook: chữ ký SAI → 400, KHÔNG lật paid, KHÔNG cấp gói', async () => {
  resetDb();
  seedPendingTxn('SW-2');
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-2'));

  const { status } = await readRes(await stripeWebhook(webhookReq(raw, { sign: false })));
  assert.equal(status, 400, 'chữ ký sai → 400');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0, 'KHÔNG cấp gói');
});

test('stripe-webhook: IDEMPOTENT — gửi lại event đã paid → 200, KHÔNG cấp lần 2', async () => {
  resetDb();
  seedPendingTxn('SW-3', { userId: 'u3' });
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-3', { amount_total: 990000 }));

  await stripeWebhook(webhookReq(raw)); // lần 1: cấp
  await stripeWebhook(webhookReq(raw)); // lần 2 (retry Stripe): idempotent
  await stripeWebhook(webhookReq(raw)); // lần 3
  assert.equal(getRows('user_subscriptions').length, 1, 'chỉ cấp 1 lần dù webhook gọi 3 lần');
});

test('stripe-webhook: SAI SỐ TIỀN (amount_total lệch giá gói) → KHÔNG cấp gói', async () => {
  resetDb();
  seedPendingTxn('SW-4', { amountVnd: 990000 });
  // Giả mạo amount_total 1000 (mua gói 990k giá 1k) — ký hợp lệ nhưng tiền lệch.
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-4', { amount_total: 1000 }));

  const res = await stripeWebhook(webhookReq(raw));
  assert.equal(res.status, 200, 'amount_mismatch → 200 (không retry)');
  assert.equal(getRows('user_subscriptions').length, 0, 'amount_mismatch → KHÔNG cấp');
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});

test('stripe-webhook: order không tồn tại → KHÔNG cấp gói', async () => {
  resetDb();
  const raw = eventBody('checkout.session.completed', checkoutSession('GHOST', { amount_total: 990000 }));
  const res = await stripeWebhook(webhookReq(raw));
  assert.equal(res.status, 200, 'not_found → 200 (không retry)');
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('stripe-webhook: payment_status != paid (async chưa trả) → 200, KHÔNG cấp', async () => {
  resetDb();
  seedPendingTxn('SW-5');
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-5', { payment_status: 'unpaid' }));

  const res = await stripeWebhook(webhookReq(raw));
  assert.equal(res.status, 200);
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('stripe-webhook: event type KHÁC → 200, bỏ qua, KHÔNG cấp', async () => {
  resetDb();
  seedPendingTxn('SW-6');
  const raw = eventBody('payment_intent.created', checkoutSession('SW-6'));

  const res = await stripeWebhook(webhookReq(raw));
  assert.equal(res.status, 200);
  assert.equal(getRows('user_subscriptions').length, 0);
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});

test('stripe-webhook: cổng CHƯA cấu hình (thiếu env) → 503, KHÔNG cấp gói', async () => {
  resetDb();
  seedPendingTxn('SW-7');
  delete process.env.STRIPE_WEBHOOK_SECRET; // isStripeConfigured() → false
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-7', { amount_total: 990000 }));

  // Không cần chữ ký hợp lệ — route trả 503 trước khi verify.
  const { status } = await readRes(await stripeWebhook(webhookReq(raw, { sign: false })));
  assert.equal(status, 503);
  assert.equal(getRows('user_subscriptions').length, 0);
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET; // khôi phục cho test sau
});

test('stripe-webhook: RPC confirm_payment CHƯA tồn tại → 500 (retry), KHÔNG cấp (fail-closed)', async () => {
  resetDb();
  const { disableRpc } = await import('./harness.mjs');
  disableRpc('confirm_payment');
  seedPendingTxn('SW-8');
  const raw = eventBody('checkout.session.completed', checkoutSession('SW-8', { amount_total: 990000 }));

  const res = await stripeWebhook(webhookReq(raw));
  // confirm_unavailable → route trả 500 (Stripe retry), KHÔNG cấp gói.
  assert.equal(res.status, 500);
  assert.equal(getRows('user_subscriptions').length, 0);
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});
