import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_TREE,
  ALL_SKILLS,
  isValidSkill,
  getSkill,
  getDomainOfSkill,
} from './skill-taxonomy.ts';

test('SKILL_TREE: có đủ 6 domain (4 kỹ năng + grammar + vocabulary)', () => {
  const ids = SKILL_TREE.map((d) => d.id).sort();
  assert.deepEqual(ids, ['grammar', 'listening', 'reading', 'speaking', 'vocabulary', 'writing']);
});

test('ALL_SKILLS: đúng 22 skill Cambridge', () => {
  assert.equal(ALL_SKILLS.length, 22, 'phải có đúng 22 skill (6+4+4+4+2+2)');
});

test('Subject: 5 giá trị reading/writing/listening/speaking/foundation', () => {
  const subjects = new Set(SKILL_TREE.map((d) => d.subject));
  assert.deepEqual([...subjects].sort(), ['foundation', 'listening', 'reading', 'speaking', 'writing']);
  // grammar + vocabulary đều subject 'foundation'.
  assert.equal(getDomainOfSkill('grammar.a2')?.subject, 'foundation');
  assert.equal(getDomainOfSkill('vocabulary.a2')?.subject, 'foundation');
});

test('skillId: tất cả phải DUY NHẤT (không trùng — vì dữ liệu mastery tham chiếu)', () => {
  const ids = ALL_SKILLS.map((s) => s.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'có skillId bị trùng');
});

test('skillId dùng prefix theo domain (reading.matching ≠ listening.matching)', () => {
  assert.ok(isValidSkill('reading.matching'));
  assert.ok(isValidSkill('listening.matching'));
  assert.notEqual('reading.matching', 'listening.matching');
});

test('isValidSkill: nhận skill thật, từ chối skill bịa', () => {
  assert.equal(isValidSkill('reading.notice_mcq'), true);
  assert.equal(isValidSkill('algebra.linear_eq'), false, 'skill Toán cũ đã bị gỡ');
  assert.equal(isValidSkill('khong_ton_tai'), false);
  assert.equal(isValidSkill(''), false);
});

test('getSkill: trả đúng object skill theo id', () => {
  const s = getSkill('grammar.b1');
  assert.ok(s, 'phải tìm thấy grammar.b1');
  assert.equal(s.id, 'grammar.b1');
  assert.ok(s.label.length > 0);
  assert.ok(s.moduleType.length > 0);
});

test('getDomainOfSkill: map skill về đúng domain cha', () => {
  const d = getDomainOfSkill('reading.notice_mcq');
  assert.ok(d);
  assert.equal(d.id, 'reading');
  assert.equal(d.subject, 'reading');
});

test('mọi skill có moduleType hợp lệ (6 giá trị Cambridge)', () => {
  const valid = new Set(['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary']);
  for (const s of ALL_SKILLS) {
    assert.ok(valid.has(s.moduleType), `moduleType lạ: ${s.moduleType} ở ${s.id}`);
  }
});

test('domain id duy nhất', () => {
  const ids = SKILL_TREE.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});
