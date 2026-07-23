import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayPlan, practiceHrefForSkill } from './today-plan.ts';
import type { MasterySummary } from './mastery.ts';
import type { AdaptiveRecommendation } from './adaptive.ts';

function fakeSummary(totalAttempts: number): MasterySummary {
  const skills = [{ id: 'algebra.linear_eq', label: 'Linear Eq', score: 40, attempts: totalAttempts, reliable: false, mastered: false, subject: 'math', moduleType: 'math', domainId: 'algebra', domainLabel: 'Algebra' }];
  return { skills, bySubject: { math: 40, reading: 0 }, overall: 40 } as MasterySummary;
}

const rec = (moduleType: string): AdaptiveRecommendation => ({
  skillId: 'algebra.linear_eq', label: 'Linear Eq', moduleType, difficulty: 'Easy', masteryScore: 40, reason: 'Mastery 40% — điểm yếu cần củng cố.',
});

test('buildTodayPlan: có due SRS → due đứng đầu (chống quên ưu tiên cao nhất)', () => {
  const plan = buildTodayPlan(fakeSummary(20), 5, rec('math'), '2026-07-15T00:00:00Z');
  assert.equal(plan.items[0].kind, 'due');
  assert.equal(plan.items[0].title, 'Ôn 5 mục đến hạn');
});

test('buildTodayPlan: không có due → weakness đứng đầu', () => {
  const plan = buildTodayPlan(fakeSummary(20), 0, rec('math'), '2026-07-15T00:00:00Z');
  assert.equal(plan.items[0].kind, 'weakness');
  assert.equal(plan.items[0].priority, 1);
});

test('buildTodayPlan: weakness skill vocab → href /vocab (không dùng /grind ultimate)', () => {
  const plan = buildTodayPlan(fakeSummary(20), 0, rec('vocab'), '2026-07-15T00:00:00Z');
  const weak = plan.items.find((i) => i.kind === 'weakness')!;
  assert.equal(weak.href, '/vocab');
});

test('buildTodayPlan: weakness skill literature → /literature', () => {
  const plan = buildTodayPlan(fakeSummary(20), 0, rec('literature'), '2026-07-15T00:00:00Z');
  assert.equal(plan.items.find((i) => i.kind === 'weakness')!.href, '/literature');
});

test('buildTodayPlan: không có recommendation → vẫn có mục stamina', () => {
  const plan = buildTodayPlan(fakeSummary(5), 0, null, '2026-07-15T00:00:00Z');
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].kind, 'stamina');
});

test('buildTodayPlan: ít câu (<10) → stamina là "khởi động 10 câu"', () => {
  const plan = buildTodayPlan(fakeSummary(3), 0, null, '2026-07-15T00:00:00Z');
  assert.match(plan.items[0].title, /Khởi động/i);
});

test('buildTodayPlan: nhiều câu (≥10) → stamina là "giữ nhịp"', () => {
  const plan = buildTodayPlan(fakeSummary(50), 0, null, '2026-07-15T00:00:00Z');
  assert.match(plan.items[0].title, /Giữ nhịp/i);
});

test('buildTodayPlan: đủ cả 3 → 3 mục, sắp priority tăng dần', () => {
  const plan = buildTodayPlan(fakeSummary(50), 5, rec('math'), '2026-07-15T00:00:00Z');
  assert.equal(plan.items.length, 3);
  const prios = plan.items.map((i) => i.priority);
  assert.deepEqual(prios, [...prios].sort((a, b) => a - b));
});

test('practiceHrefForSkill: vocab→/vocab, literature→/literature, math→/math', () => {
  assert.equal(practiceHrefForSkill('rw.vocab', 'vocab'), '/vocab');
  assert.equal(practiceHrefForSkill('rw.x', 'literature'), '/literature');
  assert.equal(practiceHrefForSkill('algebra.y', 'math'), '/math');
});
