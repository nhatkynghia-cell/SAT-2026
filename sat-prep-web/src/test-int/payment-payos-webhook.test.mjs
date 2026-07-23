/**
 * INTEGRATION — /api/payment/payos-webhook (bề mặt tiền QUAN TRỌNG: cấp gói
 * trả phí thật). Chạy THẬT route + payment-store + confirm_payment RPC.
 *
 * Bất biến sống-còn (giống momo-ipn):
 *   • CHỈ webhook đã verify chữ ký + code '00' mới cấp gói.
 *   • Chữ ký sai → 400, KHÔNG cấp (chống giả mạo callback).
 *   • IDEMPOTENT: payOS retry → alreadyConfirmed → KHÔNG double-grant.
 *   • Sai số tiền → amount_mismatch → KHÔNG cấp.
 *   • Cổng chưa cấu hình (thiếu env) → 503, KHÔNG cấp.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetDb, seed, getRows, readRes } from './harness.mjs';
import { buildPayosDataRaw } from '@/lib/payment-payos';

const PAYOS_CHECKSUM = 'TEST_PAYOS_CHECKSUM_KEY';

// Set env TRƯỚC khi import route.
process.env.PAYOS_CHECKSUM_KEY = PAYOS_CHECKSUM;
const { POST } = await import('@/app/api/payment/payos-webhook/route');

function setPayosEnv(on = true) {
  if (on) {
    process.env.PAYOS_CHECKSUM_KEY = PAYOS_CHECKSUM;
  } else {
    delete process.env.PAYOS_CHECKSUM_KEY;
  }
}

/** Ký object `data` webhook payOS đúng cách lib build (sort alphabet, null→''). */
function signPayosData(data, key = PAYOS_CHECKSUM) {
  return crypto.createHmac('sha256', key).update(buildPayosDataRaw(data)).digest('hex');
}

/** Build payload webhook: data ký riêng, signature ở top-level. */
function payosReq(orderCode, overrides = {}) {
  const data = {
    orderCode,
    amount: 990000,
    reference: `PAYOS-REF-${orderCode}`,
    ...overrides.data,
  };
  const payload = {
    code: '00',
    desc: 'Thành công',
    success: true,
    data,
    signature: overrides.signature ?? signPayosData(data),
  };
  return new Request('http://t/payos-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function seedPendingTxn(orderId, opts = {}) {
  seed('payment_transactions', {
    user_id: opts.userId ?? 'pay-user',
    order_id: orderId, // order_id = String(orderCode) — payOS dùng số dạng chuỗi
    gateway: 'payos',
    tier: opts.tier ?? 'premium',
    period: opts.period ?? 'yearly',
    amount_vnd: opts.amountVnd ?? 990000,
    status: 'pending',
    duration_days: opts.durationDays === undefined ? 365 : opts.durationDays,
    gateway_txn_id: null,
    created_at: '2026-07-01T00:00:00Z',
    paid_at: null,
  });
}

test('payos-webhook: chữ ký hợp lệ + code "00" → 200, lật paid + CẤP GÓI', async () => {
  resetDb(); setPayosEnv(true);
  const orderCode = 1700000000123;
  seedPendingTxn(String(orderCode), { userId: 'u-payos', tier: 'premium', period: 'yearly', amountVnd: 990000 });

  const { status } = await readRes(await POST(payosReq(orderCode, { data: { amount: 990000 } })));
  assert.equal(status, 200, 'payOS nhận webhook OK → 200');

  assert.equal(getRows('payment_transactions')[0].status, 'paid');
  const subs = getRows('user_subscriptions');
  assert.equal(subs.length, 1, 'đã cấp 1 gói');
  assert.equal(subs[0].user_id, 'u-payos');
  assert.equal(subs[0].tier, 'premium');
  assert.equal(subs[0].period, 'yearly');
});

test('payos-webhook: chữ ký SAI → 400, KHÔNG lật paid, KHÔNG cấp gói', async () => {
  resetDb(); setPayosEnv(true);
  const orderCode = 1700000000124;
  seedPendingTxn(String(orderCode));

  const { status } = await readRes(await POST(payosReq(orderCode, { signature: 'deadbeef'.repeat(8) })));
  assert.equal(status, 400, 'chữ ký sai → 400');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0, 'KHÔNG cấp gói');
});

test('payos-webhook: IDEMPOTENT — gọi lại webhook đã paid → 200, KHÔNG cấp lần 2', async () => {
  resetDb(); setPayosEnv(true);
  const orderCode = 1700000000125;
  seedPendingTxn(String(orderCode), { userId: 'u-idem' });

  const req = payosReq(orderCode, { data: { amount: 990000 } });
  await POST(req); // lần 1: cấp
  await POST(payosReq(orderCode, { data: { amount: 990000 } })); // retry cổng
  await POST(payosReq(orderCode, { data: { amount: 990000 } })); // retry nữa
  assert.equal(getRows('user_subscriptions').length, 1, 'chỉ cấp 1 lần dù webhook gọi 3 lần');
});

test('payos-webhook: code != "00" (thất bại/hủy) → 200, KHÔNG cấp gói', async () => {
  resetDb(); setPayosEnv(true);
  const orderCode = 1700000000126;
  seedPendingTxn(String(orderCode));

  // code 99 = thất bại. Ký trên data (chữ ký vẫn hợp lệ), chỉ code khác.
  const data = { orderCode, amount: 990000, reference: `PAYOS-REF-${orderCode}` };
  const res = await POST(
    new Request('http://t/payos-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '99', desc: 'User cancelled', success: false, data, signature: signPayosData(data) }),
    })
  );
  assert.equal(res.status, 200, 'payOS mong 200 để dừng retry');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('payos-webhook: SAI SỐ TIỀN (amount lệch giá gói) → KHÔNG cấp gói', async () => {
  resetDb(); setPayosEnv(true);
  const orderCode = 1700000000127;
  seedPendingTxn(String(orderCode), { amountVnd: 990000 });
  // Kẻ tấn công ký hợp lệ nhưng khai amount 1000 (mua gói 990k giá 1k).
  const { status } = await readRes(await POST(payosReq(orderCode, { data: { amount: 1000 } })));
  // amount_mismatch → route trả 200 success (payOS không retry vô ích) nhưng KHÔNG cấp.
  assert.equal(status, 200);
  assert.equal(getRows('user_subscriptions').length, 0, 'amount_mismatch → KHÔNG cấp');
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});

test('payos-webhook: order không tồn tại → KHÔNG cấp gói', async () => {
  resetDb(); setPayosEnv(true);
  const { status } = await readRes(await POST(payosReq(9999999999999, { data: { amount: 990000 } })));
  assert.equal(status, 200);
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('payos-webhook: cổng CHƯA cấu hình (thiếu env) → 503, KHÔNG cấp gói', async () => {
  resetDb(); setPayosEnv(false);
  const orderCode = 1700000000128;
  seedPendingTxn(String(orderCode));
  const { status } = await readRes(await POST(payosReq(orderCode, { data: { amount: 990000 } })));
  assert.equal(status, 503);
  assert.equal(getRows('user_subscriptions').length, 0);
  setPayosEnv(true); // khôi phục
});

test('payos-webhook: RPC confirm_payment CHƯA tồn tại → 500 (retry), KHÔNG cấp gói (fail-closed)', async () => {
  resetDb(); setPayosEnv(true);
  const { disableRpc } = await import('./harness.mjs');
  disableRpc('confirm_payment');
  const orderCode = 1700000000129;
  seedPendingTxn(String(orderCode));
  const { status } = await readRes(await POST(payosReq(orderCode, { data: { amount: 990000 } })));
  // confirm_unavailable → route trả 500 (retry), KHÔNG cấp gói.
  assert.equal(status, 500);
  assert.equal(getRows('user_subscriptions').length, 0);
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});
