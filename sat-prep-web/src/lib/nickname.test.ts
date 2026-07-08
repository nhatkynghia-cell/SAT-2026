import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNickname, NICKNAME_MIN, NICKNAME_MAX } from './nickname.ts';

// ── Hợp lệ ───────────────────────────────────────────────────────────────────

test('validateNickname: tên thường hợp lệ', () => {
  const r = validateNickname('MinhAnh');
  assert.equal(r.ok, true);
  assert.equal(r.normalized, 'MinhAnh');
});

test('validateNickname: tiếng Việt có dấu hợp lệ', () => {
  const r = validateNickname('Học Sinh Giỏi');
  assert.equal(r.ok, true);
  assert.equal(r.normalized, 'Học Sinh Giỏi');
});

test('validateNickname: số + gạch + chấm hợp lệ', () => {
  assert.equal(validateNickname('an_pham-2026').ok, true);
  assert.equal(validateNickname('a.b.c').ok, true);
});

test('validateNickname: trim + gom khoảng trắng', () => {
  const r = validateNickname('  Minh   Anh  ');
  assert.equal(r.ok, true);
  assert.equal(r.normalized, 'Minh Anh');
});

// ── Độ dài ───────────────────────────────────────────────────────────────────

test('validateNickname: rỗng → empty', () => {
  assert.equal(validateNickname('').reason, 'empty');
  assert.equal(validateNickname('   ').reason, 'empty');
});

test('validateNickname: quá ngắn (<3) → too_short', () => {
  assert.equal(validateNickname('ab').reason, 'too_short');
  assert.equal(validateNickname('ab').ok, false);
});

test('validateNickname: đúng ngưỡng min/max hợp lệ', () => {
  assert.equal(validateNickname('a'.repeat(NICKNAME_MIN)).ok, true);
  assert.equal(validateNickname('a'.repeat(NICKNAME_MAX)).ok, true);
});

test('validateNickname: quá dài (>20) → too_long', () => {
  assert.equal(validateNickname('a'.repeat(NICKNAME_MAX + 1)).reason, 'too_long');
});

// ── Ký tự ─────────────────────────────────────────────────────────────────────

test('validateNickname: emoji → bad_chars', () => {
  assert.equal(validateNickname('Minh😀Anh').reason, 'bad_chars');
});

test('validateNickname: ký tự đặc biệt lạ → bad_chars', () => {
  assert.equal(validateNickname('Minh@#$Anh').reason, 'bad_chars');
});

test('validateNickname: zero-width space → bad_chars', () => {
  assert.equal(validateNickname('Minh​Anh').reason, 'bad_chars');
});

// ── Blocklist (moderation cơ bản) ─────────────────────────────────────────────

test('validateNickname: từ bậy tiếng Việt → blocked', () => {
  assert.equal(validateNickname('thang dit me').reason, 'blocked');
});

test('validateNickname: từ bậy tiếng Anh → blocked', () => {
  assert.equal(validateNickname('fuckyou').reason, 'blocked');
});

test('validateNickname: lách bằng ký tự phân tách (f_u_c_k) → vẫn blocked', () => {
  assert.equal(validateNickname('f_u_c_k').reason, 'blocked');
});

test('validateNickname: lách bằng dấu tiếng Việt (đ.ị.t) → vẫn blocked', () => {
  assert.equal(validateNickname('đ.ị.t').reason, 'blocked');
});

test('validateNickname: từ vô hại chứa chuỗi con KHÔNG bị chặn nhầm', () => {
  // "Anh" không chứa từ bậy; đảm bảo không false-positive quá đà.
  assert.equal(validateNickname('Anh Tuan').ok, true);
});
