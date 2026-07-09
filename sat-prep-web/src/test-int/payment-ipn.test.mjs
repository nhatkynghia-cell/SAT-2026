/**
 * INTEGRATION — /api/payment/momo-ipn + vnpay-ipn (bề mặt tiền QUAN TRỌNG NHẤT:
 * cấp gói trả phí thật). Chạy THẬT route + payment-store + subscription-store +
 * confirm_payment RPC (model atomic) + verify chữ ký MoMo (HMAC-SHA256 thuần).
 *
 * Bất biến sống-còn:
 *   • CHỈ IPN đã verify chữ ký + resultCode thành công mới cấp gói.
 *   • Chữ ký sai → từ chối, KHÔNG cấp (chống giả mạo callback).
 *   • IDEMPOTENT: cổng retry / gọi lại → alreadyConfirmed → KHÔNG double-grant.
 *   • Sai số tiền → amount_mismatch → KHÔNG cấp.
 *   • Cổng chưa cấu hình (thiếu env) → không cấp gói.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { calculateSecureHash, buildPaymentUrlSearchParams, HashAlgorithm } from 'vnpay';
import { resetDb, seed, getRows, readRes } from './harness.mjs';

// ⚠️ VNPay creds test PHẢI set TRƯỚC khi import route (getVnpayClient cache
// singleton _client ở lần gọi đầu). Set ở top-level module = trước mọi test.
const VNP_TMN = 'TESTTMN';
const VNP_SECRET = 'TESTVNPHASHSECRET';
process.env.VNPAY_TMN_CODE = VNP_TMN;
process.env.VNPAY_HASH_SECRET = VNP_SECRET;
process.env.VNPAY_HOST = 'https://sandbox.vnpayment.vn';

const { POST: momoIpn } = await import('@/app/api/payment/momo-ipn/route');
const { GET: vnpayIpn } = await import('@/app/api/payment/vnpay-ipn/route');

const MOMO_ACCESS = 'TEST_ACCESS_KEY';
const MOMO_SECRET = 'TEST_SECRET_KEY';

function setMomoEnv(on = true) {
  if (on) {
    process.env.MOMO_ACCESS_KEY = MOMO_ACCESS;
    process.env.MOMO_SECRET_KEY = MOMO_SECRET;
  } else {
    delete process.env.MOMO_ACCESS_KEY;
    delete process.env.MOMO_SECRET_KEY;
  }
}

/** Ký payload IPN MoMo bằng đúng thứ tự field của lib (buildMomoIpnRawSignature). */
function signMomoIpn(p, accessKey = MOMO_ACCESS, secret = MOMO_SECRET) {
  const raw =
    `accessKey=${accessKey}` +
    `&amount=${p.amount}` +
    `&extraData=${p.extraData}` +
    `&message=${p.message}` +
    `&orderId=${p.orderId}` +
    `&orderInfo=${p.orderInfo}` +
    `&orderType=${p.orderType}` +
    `&partnerCode=${p.partnerCode}` +
    `&payType=${p.payType}` +
    `&requestId=${p.requestId}` +
    `&responseTime=${p.responseTime}` +
    `&resultCode=${p.resultCode}` +
    `&transId=${p.transId}`;
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function momoPayload(orderId, overrides = {}) {
  const base = {
    partnerCode: 'MOMOTEST', orderId, requestId: `req-${orderId}`,
    amount: 990000, orderInfo: 'Nang goi', orderType: 'momo_wallet',
    transId: 123456789, resultCode: 0, message: 'Successful.',
    payType: 'qr', responseTime: 1700000000000, extraData: '',
    ...overrides,
  };
  base.signature = overrides.signature ?? signMomoIpn(base);
  return base;
}

function momoReq(payload) {
  return new Request('http://t/momo-ipn', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function seedPendingTxn(orderId, opts = {}) {
  seed('payment_transactions', {
    user_id: opts.userId ?? 'pay-user', order_id: orderId, gateway: opts.gateway ?? 'momo',
    tier: opts.tier ?? 'premium', period: opts.period ?? 'yearly',
    amount_vnd: opts.amountVnd ?? 990000, status: 'pending',
    gateway_txn_id: null, created_at: '2026-07-01T00:00:00Z', paid_at: null,
  });
}

test('momo-ipn: chữ ký hợp lệ + resultCode 0 → 204, lật paid + CẤP GÓI', async () => {
  resetDb(); setMomoEnv(true);
  seedPendingTxn('ORD-1', { userId: 'u-momo', tier: 'premium', period: 'yearly', amountVnd: 990000 });

  const res = await momoIpn(momoReq(momoPayload('ORD-1', { amount: 990000 })));
  assert.equal(res.status, 204, 'MoMo nhận IPN OK → 204');

  assert.equal(getRows('payment_transactions')[0].status, 'paid');
  const subs = getRows('user_subscriptions');
  assert.equal(subs.length, 1, 'đã cấp 1 gói');
  assert.equal(subs[0].user_id, 'u-momo');
  assert.equal(subs[0].tier, 'premium');
  assert.equal(subs[0].period, 'yearly');
});

test('momo-ipn: chữ ký SAI → 400, KHÔNG lật paid, KHÔNG cấp gói', async () => {
  resetDb(); setMomoEnv(true);
  seedPendingTxn('ORD-2');
  const bad = momoPayload('ORD-2', { signature: 'deadbeef'.repeat(8) });

  const { status } = await readRes(await momoIpn(momoReq(bad)));
  assert.equal(status, 400, 'chữ ký sai → 400');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0, 'KHÔNG cấp gói');
});

test('momo-ipn: IDEMPOTENT — gọi lại IPN đã paid → 204, KHÔNG cấp gói lần 2', async () => {
  resetDb(); setMomoEnv(true);
  seedPendingTxn('ORD-3', { userId: 'u3' });
  const p = momoPayload('ORD-3', { amount: 990000 });

  await momoIpn(momoReq(p));            // lần 1: cấp
  await momoIpn(momoReq(p));            // lần 2 (retry cổng): idempotent
  await momoIpn(momoReq(p));            // lần 3
  assert.equal(getRows('user_subscriptions').length, 1, 'chỉ cấp 1 lần dù IPN gọi 3 lần');
});

test('momo-ipn: resultCode != 0 (thất bại/hủy) → 204, KHÔNG cấp gói', async () => {
  resetDb(); setMomoEnv(true);
  seedPendingTxn('ORD-4');
  const failed = momoPayload('ORD-4', { resultCode: 1006, message: 'User denied' });

  const res = await momoIpn(momoReq(failed));
  assert.equal(res.status, 204);
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('momo-ipn: SAI SỐ TIỀN (amount lệch giá gói) → KHÔNG cấp gói', async () => {
  resetDb(); setMomoEnv(true);
  seedPendingTxn('ORD-5', { amountVnd: 990000 });
  // Kẻ tấn công ký hợp lệ nhưng khai amount 1000 (mua gói 990k giá 1k).
  const p = momoPayload('ORD-5', { amount: 1000 });

  await momoIpn(momoReq(p));
  assert.equal(getRows('user_subscriptions').length, 0, 'amount_mismatch → KHÔNG cấp');
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});

test('momo-ipn: order không tồn tại → KHÔNG cấp gói', async () => {
  resetDb(); setMomoEnv(true);
  const p = momoPayload('GHOST-ORDER', { amount: 990000 });
  await momoIpn(momoReq(p));
  assert.equal(getRows('user_subscriptions').length, 0);
});

test('momo-ipn: cổng CHƯA cấu hình (thiếu env) → 503, KHÔNG cấp gói', async () => {
  resetDb(); setMomoEnv(false);
  seedPendingTxn('ORD-6');
  const { status } = await readRes(await momoIpn(momoReq(momoPayload('ORD-6'))));
  assert.equal(status, 503);
  assert.equal(getRows('user_subscriptions').length, 0);
  setMomoEnv(true); // khôi phục cho test sau
});

test('momo-ipn: RPC confirm_payment CHƯA tồn tại → KHÔNG cấp gói (fail-closed)', async () => {
  resetDb(); setMomoEnv(true);
  const { disableRpc } = await import('./harness.mjs');
  disableRpc('confirm_payment');
  seedPendingTxn('ORD-7');
  const res = await momoIpn(momoReq(momoPayload('ORD-7', { amount: 990000 })));
  // confirm_unavailable → route trả 500 (retry), KHÔNG cấp gói.
  assert.equal(res.status, 500);
  assert.equal(getRows('user_subscriptions').length, 0);
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});

// ── VNPay IPN: creds test set ở top-level → verifyIpnCall chạy THẬT (HMAC-SHA512).
//    Ký query bằng chính helper của lib để tạo IPN hợp lệ; đường verify→confirm→grant
//    được thực thi thật (không còn chết ở getVnpayClient throw như bản cũ). ──

/** Ký query VNPay hợp lệ (dùng đúng logic lib: strip hash → buildParams → HMAC-SHA512). */
function signVnpay(query) {
  const sp = buildPaymentUrlSearchParams(query);
  return calculateSecureHash({
    secureSecret: VNP_SECRET, data: sp.toString(),
    hashAlgorithm: HashAlgorithm.SHA512, bufferEncode: 'utf-8',
  });
}

/** Build GET Request IPN VNPay từ query (kèm vnp_SecureHash). */
function vnpayReq(query, { sign = true } = {}) {
  const q = { ...query };
  if (sign) q.vnp_SecureHash = signVnpay(query);
  else q.vnp_SecureHash = 'forged'.padEnd(128, '0');
  const usp = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]));
  return new Request(`http://t/vnpay-ipn?${usp.toString()}`);
}

/** Query IPN thành công điển hình. vnp_Amount ×100 (lib ÷100 khi verify). */
function vnpayOkQuery(orderId, amountVnd) {
  return {
    vnp_TmnCode: VNP_TMN, vnp_Amount: amountVnd * 100, vnp_TxnRef: orderId,
    vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '888',
    vnp_OrderInfo: 'Nang goi', vnp_PayDate: '20260705120000', vnp_BankCode: 'NCB',
  };
}

test('vnpay-ipn: chữ ký HỢP LỆ + success → RspCode 00, lật paid + CẤP GÓI (amount ÷100 khớp)', async () => {
  resetDb();
  seedPendingTxn('VNP-OK', { gateway: 'vnpay', userId: 'u-vnp', tier: 'ultimate', period: 'monthly', amountVnd: 199000 });
  // vnp_Amount trên dây = 199000×100; lib ÷100 → 199000 khớp amount_vnd → confirm OK.
  const { body } = await readRes(await vnpayIpn(vnpayReq(vnpayOkQuery('VNP-OK', 199000))));
  assert.equal(body.RspCode, '00', 'IPN hợp lệ → success');
  assert.equal(getRows('payment_transactions')[0].status, 'paid');
  const subs = getRows('user_subscriptions');
  assert.equal(subs.length, 1, 'đã cấp gói');
  assert.equal(subs[0].user_id, 'u-vnp');
  assert.equal(subs[0].tier, 'ultimate');
});

test('vnpay-ipn: chữ ký GIẢ → RspCode checksum fail, KHÔNG cấp gói', async () => {
  resetDb();
  seedPendingTxn('VNP-BAD', { gateway: 'vnpay', amountVnd: 199000 });
  const { body } = await readRes(await vnpayIpn(vnpayReq(vnpayOkQuery('VNP-BAD', 199000), { sign: false })));
  assert.notEqual(body.RspCode, '00', 'chữ ký giả → KHÔNG success');
  assert.equal(getRows('user_subscriptions').length, 0, 'KHÔNG cấp gói');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'không lật paid');
});

test('vnpay-ipn: IDEMPOTENT — IPN gọi lại đơn đã paid → alreadyConfirmed, KHÔNG cấp lần 2', async () => {
  resetDb();
  seedPendingTxn('VNP-DUP', { gateway: 'vnpay', amountVnd: 199000 });
  const req1 = vnpayReq(vnpayOkQuery('VNP-DUP', 199000));
  await vnpayIpn(req1);
  await vnpayIpn(vnpayReq(vnpayOkQuery('VNP-DUP', 199000))); // retry
  assert.equal(getRows('user_subscriptions').length, 1, 'chỉ cấp 1 lần dù IPN gọi 2 lần');
});

test('vnpay-ipn: ký HỢP LỆ nhưng GIAO DỊCH THẤT BẠI (responseCode≠00) → KHÔNG lật paid, KHÔNG cấp, ack IpnSuccess (A1)', async () => {
  resetDb();
  seedPendingTxn('VNP-FAIL', { gateway: 'vnpay', amountVnd: 199000 });
  // Chữ ký hợp lệ (ký trên chính query này) nhưng responseCode/transactionStatus='24'
  // (user hủy). KHÔNG được lật đơn thành 'paid' → tránh kẹt đơn + nuốt thanh toán thật sau.
  const failQuery = { ...vnpayOkQuery('VNP-FAIL', 199000), vnp_ResponseCode: '24', vnp_TransactionStatus: '24' };
  const { body } = await readRes(await vnpayIpn(vnpayReq(failQuery)));
  assert.equal(body.RspCode, '00', 'ack IpnSuccess để VNPay dừng retry');
  assert.equal(getRows('payment_transactions')[0].status, 'pending', 'KHÔNG lật paid');
  assert.equal(getRows('user_subscriptions').length, 0, 'KHÔNG cấp gói');
});

test('vnpay-ipn: SAI SỐ TIỀN (amount lệch amount_vnd) → KHÔNG cấp gói', async () => {
  resetDb();
  seedPendingTxn('VNP-AMT', { gateway: 'vnpay', amountVnd: 199000 });
  // Ký hợp lệ nhưng khai amount 1000 (÷100 = 10 ≠ 199000) → amount_mismatch.
  const { body } = await readRes(await vnpayIpn(vnpayReq(vnpayOkQuery('VNP-AMT', 10))));
  assert.notEqual(body.RspCode, '00');
  assert.equal(getRows('user_subscriptions').length, 0, 'amount_mismatch → KHÔNG cấp');
  assert.equal(getRows('payment_transactions')[0].status, 'pending');
});
