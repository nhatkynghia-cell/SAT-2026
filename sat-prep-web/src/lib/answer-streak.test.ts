import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAnswerStreak } from './answer-streak.ts';

test('nextAnswerStreak: đúng → tăng 1 (include câu hiện tại)', () => {
  assert.equal(nextAnswerStreak(0, true), 1);
  assert.equal(nextAnswerStreak(4, true), 5);
  assert.equal(nextAnswerStreak(14, true), 15);
});

test('nextAnswerStreak: sai → reset 0 (dù đang chuỗi cao)', () => {
  assert.equal(nextAnswerStreak(0, false), 0);
  assert.equal(nextAnswerStreak(99, false), 0);
});

test('nextAnswerStreak: current rác (âm/NaN/thập phân) → coi như 0 trước khi +1', () => {
  assert.equal(nextAnswerStreak(-5, true), 1);
  assert.equal(nextAnswerStreak(NaN, true), 1);
  assert.equal(nextAnswerStreak(3.9, true), 4); // floor(3.9)=3 → +1
});
