import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual, verifyAdminSecret } from './admin-auth.ts';

test('safeEqual: bằng hệt → true, khác → false', () => {
  assert.equal(safeEqual('abc123', 'abc123'), true);
  assert.equal(safeEqual('abc123', 'abc124'), false);
  // Khác độ dài KHÔNG được ném (băm về 32 byte trước) → chỉ false.
  assert.equal(safeEqual('short', 'a-much-longer-secret'), false);
  assert.equal(safeEqual('', ''), true);
});

test('verifyAdminSecret: FAIL-CLOSED khi ENV chưa set', () => {
  const prev = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  // Không có secret cấu hình → mọi giá trị (kể cả rỗng) đều bị từ chối.
  assert.equal(verifyAdminSecret('anything'), false);
  assert.equal(verifyAdminSecret(''), false);
  assert.equal(verifyAdminSecret(null), false);
  process.env.ADMIN_SECRET = '';
  assert.equal(verifyAdminSecret('anything'), false, 'ENV rỗng cũng fail-closed');
  if (prev === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = prev;
});

test('verifyAdminSecret: khớp secret → true, sai → false', () => {
  const prev = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'super-secret-token-xyz';
  assert.equal(verifyAdminSecret('super-secret-token-xyz'), true);
  assert.equal(verifyAdminSecret('super-secret-token-xy'), false, 'thiếu 1 ký tự → false');
  assert.equal(verifyAdminSecret('SUPER-SECRET-TOKEN-XYZ'), false, 'khác hoa/thường → false');
  assert.equal(verifyAdminSecret(null), false);
  assert.equal(verifyAdminSecret(undefined), false);
  assert.equal(verifyAdminSecret(''), false);
  if (prev === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = prev;
});
