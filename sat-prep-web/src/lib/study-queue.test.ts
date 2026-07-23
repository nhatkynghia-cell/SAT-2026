import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyQueue, pickNextSkillId } from './study-queue.ts';
import type { MasterySummary } from './mastery.ts';
import type { AdaptiveRecommendation } from './adaptive.ts';

const summary = { skills: [], bySubject: { math: 0, reading: 0 }, overall: 0 } as MasterySummary;
const rec = (): AdaptiveRecommendation => ({
  skillId: 'algebra.linear_eq', label: 'Linear Eq', moduleType: 'math', difficulty: 'Easy', masteryScore: 40, reason: 'yếu nhất',
});

test('buildStudyQueue: due mistake CÓ skill_id → đứng đầu', () => {
  const q = buildStudyQueue(summary, [{ skill_id: 'algebra.linear_eq' }], 0, rec());
  assert.equal(q[0].kind, 'due-mistake');
  assert.equal(q[0].skillId, 'algebra.linear_eq');
});

test('buildStudyQueue: due mistake KHÔNG có skill_id → bị bỏ (không biết sinh gì)', () => {
  const q = buildStudyQueue(summary, [{ skill_id: null }, {}], 0, rec());
  assert.equal(q.find((i) => i.kind === 'due-mistake'), undefined);
});

test('buildStudyQueue: thứ tự due-mistake → due-vocab → weakness', () => {
  const q = buildStudyQueue(summary, [{ skill_id: 'geo.circles' }], 5, rec());
  assert.deepEqual(q.map((i) => i.kind), ['due-mistake', 'due-vocab', 'weakness']);
});

test('buildStudyQueue: không có due → weakness đứng đầu', () => {
  const q = buildStudyQueue(summary, [], 0, rec());
  assert.equal(q[0].kind, 'weakness');
});

test('buildStudyQueue: không có recommendation → không có mục weakness', () => {
  const q = buildStudyQueue(summary, [], 3, null);
  assert.equal(q.find((i) => i.kind === 'weakness'), undefined);
  assert.equal(q[0].kind, 'due-vocab');
});

test('buildStudyQueue: rỗng hoàn toàn → mảng rỗng', () => {
  assert.deepEqual(buildStudyQueue(summary, [], 0, null), []);
});

test('buildStudyQueue: due vocab → skillId rw.vocab', () => {
  const q = buildStudyQueue(summary, [], 7, null);
  assert.equal(q[0].skillId, 'rw.vocab');
});

test('pickNextSkillId: lấy skillId item đầu', () => {
  const q = buildStudyQueue(summary, [{ skill_id: 'geo.circles' }], 0, rec());
  assert.equal(pickNextSkillId(q), 'geo.circles');
});

test('pickNextSkillId: rỗng → null', () => {
  assert.equal(pickNextSkillId([]), null);
});
