import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, computeDomainStats } from './stats.ts';
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

// ── computeDomainStats: boss theo domain (RPG 60/40 gắn học thật) ────────────

/** Summary 2 domain: algebra mạnh, geometry yếu → boss theo domain phân biệt được. */
function twoDomainSummary(): MasterySummary {
  const mk = (id, domainId, score, attempts, correct) => ({
    id, label: id, score, attempts, correct, reliable: attempts >= 5, mastered: false,
    moduleType: 'math', subject: 'math', domainId, domainLabel: domainId,
  });
  const skills = [
    mk('algebra.linear_eq', 'algebra', 100, 10, 10),
    mk('algebra.systems', 'algebra', 100, 10, 10),
    mk('geo.circles', 'geometry', 10, 10, 1),
    mk('geo.trig', 'geometry', 10, 10, 1),
  ];
  return { skills, bySubject: { math: 55, reading: 0 }, overall: 55 } as MasterySummary;
}

test('computeDomainStats: basePower CAO cho domain giỏi (algebra)', () => {
  const s = computeDomainStats(twoDomainSummary(), 'algebra');
  assert.ok(s.basePower >= 90, `algebra basePower phải cao (được ${s.basePower})`);
});

test('computeDomainStats: basePower THẤP cho domain yếu (geometry) — boss chặn nếu chưa giỏi domain', () => {
  const s = computeDomainStats(twoDomainSummary(), 'geometry');
  const algebra = computeDomainStats(twoDomainSummary(), 'algebra');
  // geometry yếu (score 10, accuracy 10%) → basePower thấp hơn NHIỀU so với algebra
  // (coverage 100% vẫn nâng phần nào, nhưng intelligence+accuracy kéo xuống).
  assert.ok(s.basePower < 45, `geometry basePower phải thấp (được ${s.basePower})`);
  assert.ok(s.basePower < algebra.basePower - 40, 'geometry << algebra (boss phân biệt domain)');
});

test('computeDomainStats: domain KHÔNG có skill → basePower 0 (gate chặn)', () => {
  const s = computeDomainStats(twoDomainSummary(), 'khong_ton_tai');
  assert.equal(s.basePower, 0);
});

test('computeDomainStats: KHÔNG dính trang bị (equipmentBonus luôn 0)', () => {
  const s = computeDomainStats(twoDomainSummary(), 'algebra');
  assert.equal(s.equipmentBonus, 0);
  assert.equal(s.totalPower, s.basePower);
});
