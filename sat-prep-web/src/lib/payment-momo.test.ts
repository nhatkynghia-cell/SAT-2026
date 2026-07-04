import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  buildMomoCreateRawSignature,
  signMomoCreate,
  buildMomoIpnRawSignature,
  verifyMomoIpnSignature,
  safeCompareHex,
  isMomoSuccess,
  type MomoCreateParams,
  type MomoIpnPayload,
} from './payment-momo.ts';

function createParams(overrides: Partial<MomoCreateParams> = {}): MomoCreateParams {
  return {
    partnerCode: 'MOMO',
    accessKey: 'F8BBA842ECF85',
    requestId: 'REQ-123',
    amount: '99000',
    orderId: 'SAT-abc',
    orderInfo: 'Nang cap goi Premium thang - Gia su AI SAT',
    redirectUrl: 'https://sat-2026.vercel.app/api/payment/return',
    ipnUrl: 'https://sat-2026.vercel.app/api/payment/momo-ipn',
    extraData: '',
    requestType: 'captureWallet',
    ...overrides,
  };
}

test('buildMomoCreateRawSignature: đúng THỨ TỰ FIELD alphabet theo sample chính thức', () => {
  const raw = buildMomoCreateRawSignature(createParams());
  // Test vector deterministic — chốt cứng thứ tự field (accessKey→requestType).
  // Nếu ai đổi thứ tự → test gãy (MoMo verify y hệt phía họ, sai order = fail chữ ký).
  const expected =
    'accessKey=F8BBA842ECF85&amount=99000&extraData=&ipnUrl=https://sat-2026.vercel.app/api/payment/momo-ipn' +
    '&orderId=SAT-abc&orderInfo=Nang cap goi Premium thang - Gia su AI SAT&partnerCode=MOMO' +
    '&redirectUrl=https://sat-2026.vercel.app/api/payment/return&requestId=REQ-123&requestType=captureWallet';
  assert.equal(raw, expected);
});

test('signMomoCreate: HMAC-SHA256 hex khớp với tính tay', () => {
  const p = createParams();
  const secret = 'test-secret-key';
  const sig = signMomoCreate(p, secret);
  const manual = crypto
    .createHmac('sha256', secret)
    .update(buildMomoCreateRawSignature(p))
    .digest('hex');
  assert.equal(sig, manual);
  assert.match(sig, /^[0-9a-f]{64}$/, 'SHA256 hex = 64 ký tự');
});

function ipnPayload(overrides: Partial<MomoIpnPayload> = {}): MomoIpnPayload {
  return {
    partnerCode: 'MOMO',
    orderId: 'SAT-abc',
    requestId: 'REQ-123',
    amount: 99000,
    orderInfo: 'Nang cap goi Premium thang',
    orderType: 'momo_wallet',
    transId: 2147483647,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1690000000000,
    extraData: '',
    signature: '',
    ...overrides,
  };
}

test('verifyMomoIpnSignature: chữ ký hợp lệ → true (sign rồi verify round-trip)', () => {
  const accessKey = 'F8BBA842ECF85';
  const secret = 'test-secret-key';
  const p = ipnPayload();
  // Tự ký giống MoMo sẽ ký rồi gắn vào payload
  const raw = buildMomoIpnRawSignature(p, accessKey);
  p.signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  assert.equal(verifyMomoIpnSignature(p, accessKey, secret), true);
});

test('verifyMomoIpnSignature: tamper 1 field (amount) → chữ ký cũ KHÔNG khớp → false', () => {
  const accessKey = 'F8BBA842ECF85';
  const secret = 'test-secret-key';
  const p = ipnPayload();
  const raw = buildMomoIpnRawSignature(p, accessKey);
  p.signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  // Kẻ tấn công đổi số tiền nhưng giữ chữ ký cũ.
  p.amount = 1;
  assert.equal(verifyMomoIpnSignature(p, accessKey, secret), false);
});

test('verifyMomoIpnSignature: sai secretKey → false (không giả mạo được)', () => {
  const accessKey = 'F8BBA842ECF85';
  const p = ipnPayload();
  const raw = buildMomoIpnRawSignature(p, accessKey);
  p.signature = crypto.createHmac('sha256', 'real-secret').update(raw).digest('hex');

  assert.equal(verifyMomoIpnSignature(p, accessKey, 'wrong-secret'), false);
});

test('safeCompareHex: bằng nhau → true; khác/khác độ dài → false', () => {
  const h = crypto.createHmac('sha256', 'k').update('x').digest('hex');
  assert.equal(safeCompareHex(h, h), true);
  assert.equal(safeCompareHex(h, h.slice(0, -2) + '00'), false);
  assert.equal(safeCompareHex(h, 'abc'), false); // khác độ dài
  assert.equal(safeCompareHex('', ''), true);
});

test('isMomoSuccess: chỉ resultCode 0 (số hoặc chuỗi) là thành công', () => {
  assert.equal(isMomoSuccess(0), true);
  assert.equal(isMomoSuccess('0'), true);
  assert.equal(isMomoSuccess(1006), false);
  assert.equal(isMomoSuccess('49'), false);
});
