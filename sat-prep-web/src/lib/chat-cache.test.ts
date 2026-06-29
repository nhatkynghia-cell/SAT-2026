import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatCacheHash } from './chat-cache.ts';

const base = {
  question: 'If 2x + 3 = 11, what is x?',
  correctAnswer: 'B) 4',
  selectedAnswer: 'A) 3',
  userMessage: 'Giải thích giúp em',
};

test('chatCacheHash: cùng input → cùng hash (ổn định)', () => {
  assert.equal(chatCacheHash(base), chatCacheHash({ ...base }));
});

test('chatCacheHash: trả về chuỗi hex SHA256 dài 64 ký tự', () => {
  const h = chatCacheHash(base);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('chatCacheHash: userMessage không phân biệt hoa/thường (tăng tỉ lệ trùng)', () => {
  assert.equal(
    chatCacheHash({ ...base, userMessage: 'Giải Thích Giúp Em' }),
    chatCacheHash({ ...base, userMessage: 'giải thích giúp em' })
  );
});

test('chatCacheHash: bỏ khoảng trắng đầu/cuối (trim) ở mọi trường', () => {
  assert.equal(
    chatCacheHash({
      question: '  ' + base.question + '  ',
      correctAnswer: base.correctAnswer + '\n',
      selectedAnswer: '\t' + base.selectedAnswer,
      userMessage: '  Giải thích giúp em  ',
    }),
    chatCacheHash(base)
  );
});

test('chatCacheHash: đổi câu hỏi → khác hash (không đụng cache nhầm)', () => {
  assert.notEqual(chatCacheHash(base), chatCacheHash({ ...base, question: 'If 3x = 9?' }));
});

test('chatCacheHash: đổi đáp án đã chọn → khác hash', () => {
  assert.notEqual(chatCacheHash(base), chatCacheHash({ ...base, selectedAnswer: 'C) 5' }));
});
