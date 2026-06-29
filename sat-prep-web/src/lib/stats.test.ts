import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from './stats.ts';
import type { MasterySummary } from './mastery.ts';

// Dựng MasterySummary giả. overall tự tính = trung bình score (làm tròn).
function fakeSummary(
  entries: Record<string, { score: number; attempts: number; correct: number }>
): MasterySummary {
  const skills = Object.entries(entries).map(([id, v]) => ({
    id,
    label: id,
    score: v.score,
    attempts: v.attempts,
    correct: v.correct,
    reliable: v.attempts >= 5,
    mastered: false,
    moduleType: 'math',
    subject: 'math' as const,
    domainId: 'algebra',
    domainLabel: 'Heart of Algebra',
  }));
  const overall = skills.length
    ? Math.round(skills.reduce((s, k) => s + k.score, 0) / skills.length)
    : 0;
  return { skills, bySubject: { math: overall, reading: 0 }, overall } as MasterySummary;
}

test('user mới (chưa làm gì) → mọi chỉ số = 0', () => {
  const s = computeStats(fakeSummary({ a: { score: 0, attempts: 0, correct: 0 } }));
  assert.equal(s.intelligence, 0);
  assert.equal(s.accuracy, 0);
  assert.equal(s.coverage, 0);
  assert.equal(s.basePower, 0);
  assert.equal(s.totalPower, 0);
});

test('accuracy = tổng đúng / tổng làm', () => {
  const s = computeStats(fakeSummary({
    a: { score: 50, attempts: 10, correct: 8 },
    b: { score: 50, attempts: 10, correct: 2 },
  }));
  // 10/20 = 50%
  assert.equal(s.accuracy, 50);
});

test('coverage = % skill đã luyện ít nhất 1 lần', () => {
  const s = computeStats(fakeSummary({
    a: { score: 60, attempts: 5, correct: 3 },
    b: { score: 0, attempts: 0, correct: 0 },  // chưa luyện
  }));
  assert.equal(s.coverage, 50); // 1/2 skill đã luyện
});

test('intelligence = mastery trung bình (overall)', () => {
  const s = computeStats(fakeSummary({
    a: { score: 80, attempts: 5, correct: 4 },
    b: { score: 40, attempts: 5, correct: 2 },
  }));
  assert.equal(s.intelligence, 60); // (80+40)/2
});

test('🔴 TRANG BỊ CHỈ LÀ BONUS: basePower KHÔNG đổi theo equipmentBonus', () => {
  const summary = fakeSummary({ a: { score: 100, attempts: 10, correct: 10 } });
  const noEquip = computeStats(summary, 0);
  const withEquip = computeStats(summary, 50);
  // basePower (năng lực thật) giống hệt nhau bất kể trang bị.
  assert.equal(noEquip.basePower, withEquip.basePower);
  // chỉ totalPower tăng đúng bằng bonus.
  assert.equal(withEquip.totalPower, withEquip.basePower + 50);
});

test('basePower = 100 khi mọi chỉ số đạt tối đa', () => {
  const s = computeStats(fakeSummary({ a: { score: 100, attempts: 10, correct: 10 } }), 0);
  // intelligence=100, accuracy=100, coverage=100 → basePower=100.
  assert.equal(s.basePower, 100);
});

test('equipmentBonus âm bị kẹp về 0 (không cho hack power âm/ảo)', () => {
  const s = computeStats(fakeSummary({ a: { score: 50, attempts: 5, correct: 3 } }), -999);
  assert.equal(s.equipmentBonus, 0);
  assert.equal(s.totalPower, s.basePower);
});
