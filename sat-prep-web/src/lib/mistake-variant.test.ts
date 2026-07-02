import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVariantRequest, type SkillLike } from './mistake-variant.ts';

/**
 * Test buildVariantRequest — Nhóm 7 #6 (Mistake→biến thể).
 */

const MATH_SKILL: SkillLike = { id: 'algebra.linear_eq', moduleType: 'math', label: 'Phương trình bậc nhất' };
const VOCAB_SKILL: SkillLike = { id: 'rw.vocab', moduleType: 'vocab', label: 'Từ vựng trong ngữ cảnh' };

test('buildVariantRequest: skill hợp lệ → payload đầy đủ, echo đúng skillId + difficulty tiêm', () => {
  const req = buildVariantRequest(MATH_SKILL, 'Medium');
  assert.ok(req);
  assert.equal(req.skillId, 'algebra.linear_eq');
  assert.equal(req.moduleType, 'math');
  assert.equal(req.topic, 'Phương trình bậc nhất');
  assert.equal(req.difficulty, 'Medium');
});

test('buildVariantRequest: skill null/undefined → null (câu sai cũ chưa gắn skill)', () => {
  assert.equal(buildVariantRequest(null, 'Easy'), null);
  assert.equal(buildVariantRequest(undefined, 'Easy'), null);
});

test('buildVariantRequest: moduleType lấy đúng từ skill được tiêm (reading skill → vocab)', () => {
  assert.equal(buildVariantRequest(VOCAB_SKILL, 'Easy')?.moduleType, 'vocab');
});

test('buildVariantRequest: difficulty do caller quyết (ZPD) — echo nguyên vẹn', () => {
  assert.equal(buildVariantRequest(MATH_SKILL, 'Easy')?.difficulty, 'Easy');
  assert.equal(buildVariantRequest(MATH_SKILL, 'Hard')?.difficulty, 'Hard');
});
