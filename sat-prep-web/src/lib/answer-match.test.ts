import { test } from 'node:test';
import assert from 'node:assert';
import { matchesAnswer, normalizeAnswer } from './answer-match.ts';

// ── Câu trắc nghiệm CÓ NHÃN (A)/B)...) — giữ hành vi cũ (so ký tự đầu) ──
test('labeled: client gửi cả chuỗi có nhãn, khớp chữ cái đầu → đúng', () => {
  assert.equal(matchesAnswer('B) The transformative power', 'B) The transformative power'), true);
  assert.equal(matchesAnswer('C) Sorrow', 'C) Sorrow'), true);
});

test('labeled: chọn nhãn khác → sai', () => {
  assert.equal(matchesAnswer('A) Joy', 'C) Sorrow'), false);
  assert.equal(matchesAnswer('D) ...', 'B) ...'), false);
});

// ── 🔴 LỖI CRITICAL cũ: đáp án THÔ, mọi lựa chọn cùng ký tự đầu ──
test('raw "x = 2": chọn SAI "x = 3" KHÔNG được chấm đúng (lỗ faucet cũ)', () => {
  assert.equal(matchesAnswer('x = 3', 'x = 2'), false); // trước đây trả TRUE (bug)
  assert.equal(matchesAnswer('x = 1', 'x = 2'), false);
  assert.equal(matchesAnswer('x = 2', 'x = 2'), true);  // chọn đúng vẫn đúng
});

test('raw tọa độ "(1, 0)": chọn sai cùng "(" KHÔNG chấm đúng', () => {
  assert.equal(matchesAnswer('(0, 2)', '(1, 0)'), false); // trước đây TRUE (bug)
  assert.equal(matchesAnswer('(1, 0)', '(1, 0)'), true);
});

test('raw phân số "$\\frac{4}{5}$": lựa chọn khác cùng "$" KHÔNG chấm đúng', () => {
  assert.equal(matchesAnswer('$\\frac{1}{5}$', '$\\frac{4}{5}$'), false);
  assert.equal(matchesAnswer('$\\frac{4}{5}$', '$\\frac{4}{5}$'), true);
});

test('raw 1 từ "tranquility": khớp chính xác, phân biệt từ khác', () => {
  assert.equal(matchesAnswer('tranquility', 'tranquility'), true);
  assert.equal(matchesAnswer('turbulence', 'tranquility'), false); // cùng 't' nhưng khác từ
});

// ── Chuẩn hoá khoảng trắng ──
test('chuẩn hoá: khác khoảng trắng thừa vẫn khớp', () => {
  assert.equal(matchesAnswer('  x = 2 ', 'x = 2'), true);
  assert.equal(matchesAnswer('(1,  0)', '(1, 0)'), true); // gom nhiều dấu cách
});

// ── Rỗng KHÔNG BAO GIỜ khớp (đóng lỗ undefined===undefined) ──
test('rỗng/null không khớp rỗng', () => {
  assert.equal(matchesAnswer('', ''), false);
  assert.equal(matchesAnswer(null, null), false);
  assert.equal(matchesAnswer(undefined, 'x = 2'), false);
  assert.equal(matchesAnswer('x = 2', ''), false);
});

test('normalizeAnswer: gom khoảng trắng', () => {
  assert.equal(normalizeAnswer('  a   b  '), 'a b');
  assert.equal(normalizeAnswer(null), '');
});
