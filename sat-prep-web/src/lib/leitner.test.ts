import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promote, nextReview, isDue, BOX_INTERVALS, MAX_BOX, todayStr } from './leitner.ts';

test('promote: nhớ thì lên 1 box', () => {
  assert.equal(promote(1, true), 2);
  assert.equal(promote(3, true), 4);
});

test('promote: nhớ ở box tối đa thì giữ nguyên MAX_BOX', () => {
  assert.equal(promote(MAX_BOX, true), MAX_BOX);
  assert.equal(promote(5, true), 5);
});

test('promote: quên thì rớt về box 1 (từ bất kỳ box nào)', () => {
  assert.equal(promote(2, false), 1);
  assert.equal(promote(5, false), 1);
  assert.equal(promote(1, false), 1);
});

test('nextReview: ngày ôn kế tiếp cách đúng số ngày của box', () => {
  // Box 1 = +1 ngày, box 5 = +14 ngày (so với hôm nay).
  const today = new Date();
  for (const box of [1, 2, 3, 4, 5]) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() + BOX_INTERVALS[box]);
    assert.equal(nextReview(box), expected.toISOString().split('T')[0]);
  }
});

test('isDue: ngày trong quá khứ → đến hạn', () => {
  assert.equal(isDue('2020-01-01'), true);
});

test('isDue: chưa có lịch (undefined) → coi như đến hạn', () => {
  assert.equal(isDue(undefined), true);
});

test('isDue: ngày tương lai → chưa đến hạn', () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  assert.equal(isDue(future.toISOString().split('T')[0]), false);
});

test('isDue: đúng hôm nay → đến hạn (<=)', () => {
  assert.equal(isDue(todayStr()), true);
});

test('BOX_INTERVALS: đúng dãy Leitner 1,2,4,7,14', () => {
  assert.deepEqual(BOX_INTERVALS, { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });
});
