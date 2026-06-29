import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_TREE,
  ALL_SKILLS,
  isValidSkill,
  getSkill,
  getDomainOfSkill,
} from './skill-taxonomy.ts';

test('SKILL_TREE: có đủ 4 domain Toán + 1 domain Reading', () => {
  const mathDomains = SKILL_TREE.filter((d) => d.subject === 'math');
  const readingDomains = SKILL_TREE.filter((d) => d.subject === 'reading');
  assert.equal(mathDomains.length, 4, 'phải có 4 chương Toán');
  assert.equal(readingDomains.length, 1, 'phải có 1 domain Reading');
});

test('ALL_SKILLS: đúng 16 dạng Toán (4×4)', () => {
  const mathSkills = ALL_SKILLS.filter((s) => {
    const d = getDomainOfSkill(s.id);
    return d?.subject === 'math';
  });
  assert.equal(mathSkills.length, 16, 'phải có đúng 16 dạng Toán chuẩn SAT');
});

test('skillId: tất cả phải DUY NHẤT (không trùng — vì dữ liệu mastery tham chiếu)', () => {
  const ids = ALL_SKILLS.map((s) => s.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'có skillId bị trùng');
});

test('isValidSkill: nhận skill thật, từ chối skill bịa', () => {
  assert.equal(isValidSkill('algebra.linear_eq'), true);
  assert.equal(isValidSkill('khong_ton_tai'), false);
  assert.equal(isValidSkill(''), false);
});

test('getSkill: trả đúng object skill theo id', () => {
  const s = getSkill('geo.trig');
  assert.ok(s, 'phải tìm thấy geo.trig');
  assert.equal(s.id, 'geo.trig');
  assert.ok(s.label.length > 0);
  assert.ok(s.moduleType.length > 0);
});

test('getDomainOfSkill: map skill về đúng domain cha', () => {
  const d = getDomainOfSkill('algebra.linear_eq');
  assert.ok(d);
  assert.equal(d.id, 'algebra');
  assert.equal(d.subject, 'math');
});

test('mọi skill đều có moduleType hợp lệ (math/literature/desmos/vocab)', () => {
  const valid = new Set(['math', 'literature', 'desmos', 'vocab']);
  for (const s of ALL_SKILLS) {
    assert.ok(valid.has(s.moduleType), `moduleType lạ: ${s.moduleType} ở ${s.id}`);
  }
});

test('domain id duy nhất', () => {
  const ids = SKILL_TREE.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});
