import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidGateway,
  isValidTier,
  isValidPeriod,
  generateOrderId,
  buildOrderInfo,
} from './payment.ts';

test('isValidGateway: chỉ chấp nhận stripe (vnpay/momo đã disable, chờ creds doanh nghiệp)', () => {
  assert.equal(isValidGateway('stripe'), true);
  assert.equal(isValidGateway('vnpay'), false); // disable ở tầng app (code còn nguyên)
  assert.equal(isValidGateway('momo'), false);
  assert.equal(isValidGateway(''), false);
  assert.equal(isValidGateway(undefined), false);
  assert.equal(isValidGateway(123), false);
});

test('isValidTier: chỉ premium/ultimate (không free, không rác)', () => {
  assert.equal(isValidTier('premium'), true);
  assert.equal(isValidTier('ultimate'), true);
  assert.equal(isValidTier('free'), false);
  assert.equal(isValidTier('admin'), false);
  assert.equal(isValidTier(null), false);
});

test('isValidPeriod: chỉ monthly/quarterly/semiannual/yearly', () => {
  assert.equal(isValidPeriod('monthly'), true);
  assert.equal(isValidPeriod('quarterly'), true);
  assert.equal(isValidPeriod('semiannual'), true);
  assert.equal(isValidPeriod('yearly'), true);
  assert.equal(isValidPeriod('daily'), false);
  assert.equal(isValidPeriod(''), false);
});

test('generateOrderId: prefix SAT-, duy nhất, đủ dài', () => {
  const a = generateOrderId();
  const b = generateOrderId();
  assert.ok(a.startsWith('SAT-'), 'phải có prefix SAT-');
  assert.notEqual(a, b, 'hai lần sinh phải khác nhau');
  assert.ok(a.length >= 20, 'đủ dài (uuid) → không đoán được');
});

test('buildOrderInfo: ASCII không dấu, chứa tier + period', () => {
  const info = buildOrderInfo('ultimate', 'yearly');
  assert.match(info, /Ultimate/);
  assert.match(info, /nam/);
  // Không dấu tiếng Việt (VNPay yêu cầu) — chỉ ASCII in được.
  assert.match(info, /^[\x20-\x7E]*$/, 'phải là ASCII in được');
  assert.match(buildOrderInfo('premium', 'monthly'), /Premium.*thang/);
  assert.match(buildOrderInfo('premium', 'quarterly'), /Premium.*3thang/);
  assert.match(buildOrderInfo('ultimate', 'semiannual'), /Ultimate.*6thang/);
});
