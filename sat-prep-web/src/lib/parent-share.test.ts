import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateShareCode, isValidCodeFormat, isCodeUsable } from './parent-share.ts';

test('generateShareCode: đúng prefix PH- + độ dài 13 (PH- + 10)', () => {
  const c = generateShareCode();
  assert.ok(c.startsWith('PH-'), `mã phải bắt đầu PH-: ${c}`);
  assert.equal(c.length, 13);
});

test('generateShareCode: 2 lần sinh khác nhau (crypto random)', () => {
  const set = new Set(Array.from({ length: 50 }, () => generateShareCode()));
  assert.equal(set.size, 50, 'không được trùng trong 50 lần sinh');
});

test('generateShareCode: chỉ chứa alphabet an toàn (không 0/O/1/I/L/U)', () => {
  const c = generateShareCode().slice(3);
  assert.ok(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]+$/.test(c), `ký tự lạ: ${c}`);
});

test('isValidCodeFormat: chấp nhận mã đúng, từ chối mã sai', () => {
  assert.ok(isValidCodeFormat(generateShareCode()));
  assert.equal(isValidCodeFormat('ABC123'), false); // thiếu prefix
  assert.equal(isValidCodeFormat('PH-short'), false); // sai độ dài
  assert.equal(isValidCodeFormat('PH-0OIL111111'), false); // ký tự cấm
  assert.equal(isValidCodeFormat(123), false);
  assert.equal(isValidCodeFormat(null), false);
});

test('isCodeUsable: null/undefined → false', () => {
  assert.equal(isCodeUsable(null, Date.now()), false);
  assert.equal(isCodeUsable(undefined, Date.now()), false);
});

test('isCodeUsable: revoked → false', () => {
  assert.equal(isCodeUsable({ revoked: true, expires_at: null }, Date.now()), false);
});

test('isCodeUsable: không hạn + chưa thu hồi → true', () => {
  assert.equal(isCodeUsable({ revoked: false, expires_at: null }, Date.now()), true);
});

test('isCodeUsable: hết hạn → false, còn hạn → true', () => {
  const now = 1_800_000_000_000;
  assert.equal(isCodeUsable({ revoked: false, expires_at: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isCodeUsable({ revoked: false, expires_at: new Date(now + 86400_000).toISOString() }, now), true);
});
