import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkillTree, DOMAIN_UNLOCK_THRESHOLD, DOMAIN_PREREQS } from './skill-tree.ts';
import type { MasterySummary } from './mastery.ts';

// Map chương cho các skill dùng trong test (khớp taxonomy thật).
const DOMAIN: Record<string, { domainId: string; domainLabel: string; subject: 'math' | 'reading'; moduleType: string }> = {
  'algebra.linear_eq': { domainId: 'algebra', domainLabel: 'Heart of Algebra', subject: 'math', moduleType: 'math' },
  'algebra.systems': { domainId: 'algebra', domainLabel: 'Heart of Algebra', subject: 'math', moduleType: 'math' },
  'advanced.quadratic': { domainId: 'advanced_math', domainLabel: 'Advanced Math', subject: 'math', moduleType: 'math' },
  'geo.trig': { domainId: 'geometry', domainLabel: 'Geometry', subject: 'math', moduleType: 'math' },
  'rw.vocab': { domainId: 'reading_writing', domainLabel: 'Reading & Writing', subject: 'reading', moduleType: 'vocab' },
};

function fakeSummary(
  entries: Record<string, { score: number; attempts: number; mastered?: boolean }>
): MasterySummary {
  const skills = Object.entries(entries).map(([id, v]) => ({
    id,
    label: id,
    score: v.score,
    attempts: v.attempts,
    reliable: v.attempts >= 5,
    mastered: v.mastered ?? false,
    ...DOMAIN[id],
  }));
  return { skills, bySubject: { math: 0, reading: 0 }, overall: 0 } as MasterySummary;
}

test('node algebra: chưa luyện → available (chương gốc không có tiên quyết)', () => {
  const view = buildSkillTree(fakeSummary({ 'algebra.linear_eq': { score: 0, attempts: 0 } }));
  const n = view.nodes.find((x) => x.id === 'algebra.linear_eq');
  assert.equal(n?.state, 'available');
});

test('node đã làm nhưng chưa thạo → in_progress', () => {
  const view = buildSkillTree(fakeSummary({ 'algebra.linear_eq': { score: 50, attempts: 6 } }));
  assert.equal(view.nodes.find((x) => x.id === 'algebra.linear_eq')?.state, 'in_progress');
});

test('node mastered → mastered + đếm vào masteredCount', () => {
  const view = buildSkillTree(fakeSummary({ 'algebra.linear_eq': { score: 90, attempts: 8, mastered: true } }));
  assert.equal(view.nodes.find((x) => x.id === 'algebra.linear_eq')?.state, 'mastered');
  assert.equal(view.masteredCount, 1);
});

test('chương phụ thuộc bị KHÓA khi Đại số chưa đạt ngưỡng', () => {
  // Đại số avg thấp (< ngưỡng) → advanced_math bị khóa.
  const view = buildSkillTree(fakeSummary({
    'algebra.linear_eq': { score: 10, attempts: 5 },
    'advanced.quadratic': { score: 0, attempts: 0 },
  }));
  const adv = view.nodes.find((x) => x.id === 'advanced.quadratic');
  assert.equal(adv?.state, 'locked');
  assert.ok(adv?.lockedBy && adv.lockedBy.length > 0, 'phải nêu chương tiên quyết');
});

test('chương phụ thuộc MỞ KHÓA khi Đại số đạt ngưỡng', () => {
  // Đại số avg >= ngưỡng → advanced_math mở.
  const view = buildSkillTree(fakeSummary({
    'algebra.linear_eq': { score: DOMAIN_UNLOCK_THRESHOLD + 10, attempts: 6 },
    'advanced.quadratic': { score: 0, attempts: 0 },
  }));
  assert.equal(view.nodes.find((x) => x.id === 'advanced.quadratic')?.state, 'available');
});

test('avg chương tính trên TẤT CẢ skill của chương (kể cả skill chưa làm = 0)', () => {
  // 1 skill algebra = 80, skill algebra khác = 0 → avg = 40.
  const view = buildSkillTree(fakeSummary({
    'algebra.linear_eq': { score: 80, attempts: 6 },
    'algebra.systems': { score: 0, attempts: 0 },
  }));
  const dom = view.domains.find((d) => d.id === 'algebra');
  assert.equal(dom?.avgScore, 40);
});

test('Reading độc lập — không bị khóa bởi Đại số', () => {
  const view = buildSkillTree(fakeSummary({
    'algebra.linear_eq': { score: 0, attempts: 0 },
    'rw.vocab': { score: 0, attempts: 0 },
  }));
  assert.equal(view.nodes.find((x) => x.id === 'rw.vocab')?.state, 'available');
});

test('DOMAIN_PREREQS: advanced/data/geometry đều cần algebra; reading & algebra không cần gì', () => {
  assert.deepEqual(DOMAIN_PREREQS.advanced_math, ['algebra']);
  assert.deepEqual(DOMAIN_PREREQS.geometry, ['algebra']);
  assert.deepEqual(DOMAIN_PREREQS.data_analysis, ['algebra']);
  assert.deepEqual(DOMAIN_PREREQS.algebra, []);
  assert.deepEqual(DOMAIN_PREREQS.reading_writing, []);
});
