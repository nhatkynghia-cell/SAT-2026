import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  buildPayosCreateRaw,
  signPayosCreate,
  buildPayosDataRaw,
  verifyPayosWebhook,
  isPayosSuccess,
  generatePayosOrderCode,
} from './payment-payos.ts';

const CHECKSUM = 'test-checksum-key-very-secret';

const baseParams = {
  orderCode: 1700000000000,
  amount: 499000,
  description: 'Nang cap goi Premium',
  cancelUrl: 'https://app.test/upgrade?status=unknown',
  returnUrl: 'https://app.test/api/payment/return?orderId=1700000000000',
};

test('buildPayosCreateRaw: thứ tự field alphabet cố định (amount,cancelUrl,description,orderCode,returnUrl)', () => {
  const raw = buildPayosCreateRaw(baseParams);
  // Phải bắt đầu bằng amount=, kết thúc returnUrl=, không có field nào khác.
  assert.ok(raw.startsWith('amount=499000&'));
  assert.ok(raw.endsWith('&returnUrl=https://app.test/api/payment/return?orderId=1700000000000'));
  assert.equal(raw, `amount=${baseParams.amount}&cancelUrl=${baseParams.cancelUrl}&description=${baseParams.description}&orderCode=${baseParams.orderCode}&returnUrl=${baseParams.returnUrl}`);
});

test('signPayosCreate: HMAC-SHA256(checksumKey, raw) hex — khớp tính tay', () => {
  const expected = crypto.createHmac('sha256', CHECKSUM).update(buildPayosCreateRaw(baseParams)).digest('hex');
  assert.equal(signPayosCreate(baseParams, CHECKSUM), expected);
  // Khác checksumKey → khác chữ ký (chốt bảo mật).
  assert.notEqual(signPayosCreate(baseParams, CHECKSUM + 'x'), expected);
});

test('buildPayosDataRaw: sort key alphabet, null/undefined → chuỗi rỗng', () => {
  const raw = buildPayosDataRaw({ orderCode: 123, amount: 1000, reference: 'REF', note: null, empty: undefined });
  // key sort: amount, empty, note, orderCode, reference → empty/note = ''
  assert.equal(raw, 'amount=1000&empty=&note=&orderCode=123&reference=REF');
});

test('verifyPayosWebhook: chữ ký đúng → true; sai/tamper → false', () => {
  const data = { orderCode: 1700000000000, amount: 499000, reference: 'PAYOS-REF-1' };
  const sig = crypto.createHmac('sha256', CHECKSUM).update(buildPayosDataRaw(data)).digest('hex');
  assert.equal(verifyPayosWebhook(data, sig, CHECKSUM), true);

  // Tamper 1 field → chữ ký không khớp.
  assert.equal(verifyPayosWebhook({ ...data, amount: 1 }, sig, CHECKSUM), false);
  // Sai checksumKey → false.
  assert.equal(verifyPayosWebhook(data, sig, 'wrong-key'), false);
  // Chữ ký rỗng/không phải hex → false (không ném).
  assert.equal(verifyPayosWebhook(data, 'not-hex', CHECKSUM), false);
  assert.equal(verifyPayosWebhook(data, '', CHECKSUM), false);
});

test('isPayosSuccess: code === "00" (string hoặc number) → true, còn lại false', () => {
  assert.equal(isPayosSuccess('00'), true);
  assert.equal(isPayosSuccess(0), false, '0 (number) KHÔNG phải "00" → false');
  assert.equal(isPayosSuccess('01'), false);
  assert.equal(isPayosSuccess(undefined), false);
  assert.equal(isPayosSuccess(null), false);
});

test('generatePayosOrderCode: số nguyên dương, ≤ 2^53-1, 2 lần khác nhau', () => {
  const origNow = Date.now;
  Date.now = () => 1700000000000;
  try {
    const a = generatePayosOrderCode();
    const b = generatePayosOrderCode();
    assert.ok(Number.isInteger(a), 'phải là số nguyên');
    assert.ok(a > 0);
    assert.ok(a <= 9007199254740991, 'dưới trần an toàn cho JS number');
    assert.notEqual(a, b, '2 lần sinh cùng mili-giây phải khác nhau nhờ counter');
  } finally {
    Date.now = origNow;
  }
});

test('generatePayosOrderCode: chuỗi hóa dùng làm order_id hợp lệ (chuỗi số)', () => {
  const code = generatePayosOrderCode();
  assert.match(String(code), /^[0-9]+$/, 'String(orderCode) chỉ chứa chữ số → khớp cột order_id');
});
