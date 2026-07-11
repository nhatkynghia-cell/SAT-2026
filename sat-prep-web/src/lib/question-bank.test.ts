import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildBankRow, MIN_POOL } from './question-bank.ts';

describe('question-bank — buildBankRow (chuẩn hóa schema, Bước 0)', () => {
  const sampleData = {
    practice_question: 'What is 2 + 2?',
    choices: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
    correct_choice: 'B) 4',
    explanation: 'Cộng đơn giản.',
    difficulty: 'Easy',
    trapRate: 15,
  };

  test('persist skillId vào CẢ cột skill_id LẪN data.skillId', () => {
    const row = buildBankRow('math', 'phép cộng', sampleData, 'algebra.linear_eq');
    assert.equal(row.skill_id, 'algebra.linear_eq');
    assert.equal((row.data as Record<string, unknown>).skillId, 'algebra.linear_eq');
    assert.equal(row.module_type, 'math');
    assert.equal(row.topic, 'phép cộng');
    assert.equal(row.difficulty, 'Easy');
    assert.equal(row.usage_count, 0);
  });

  test('id ổn định theo nội dung (dedup) — cùng câu → cùng id', () => {
    const a = buildBankRow('math', 'topic X', sampleData, 'algebra.linear_eq');
    const b = buildBankRow('math', 'topic Y khác', sampleData, 'geo.circles');
    // id chỉ hash theo module + practice_question + full_passage → topic/skill khác
    // vẫn cùng id (đúng: cùng NỘI DUNG câu = 1 entry, tránh trùng lặp).
    assert.equal(a.id, b.id);
    assert.match(a.id, /^[0-9a-f]{16}$/);
  });

  test('module khác → id khác dù cùng nội dung', () => {
    const m = buildBankRow('math', 't', sampleData);
    const v = buildBankRow('vocab', 't', sampleData);
    assert.notEqual(m.id, v.id);
  });

  test('không truyền skillId nhưng data đã có → GIỮ (không xoá)', () => {
    const withSkill = { ...sampleData, skillId: 'data.statistics' };
    const row = buildBankRow('math', 't', withSkill);
    assert.equal(row.skill_id, 'data.statistics');
    assert.equal((row.data as Record<string, unknown>).skillId, 'data.statistics');
  });

  test('skillId truyền vào GHI ĐÈ giá trị cũ trong data', () => {
    const withSkill = { ...sampleData, skillId: 'algebra.linear_eq' };
    const row = buildBankRow('math', 't', withSkill, 'geo.trig');
    assert.equal(row.skill_id, 'geo.trig');
    assert.equal((row.data as Record<string, unknown>).skillId, 'geo.trig');
  });

  test('không có skillId ở đâu cả → skill_id = null, data KHÔNG thêm khoá skillId', () => {
    const row = buildBankRow('vocab', 't', sampleData);
    assert.equal(row.skill_id, null);
    assert.equal('skillId' in (row.data as Record<string, unknown>), false);
  });

  test('difficulty thiếu trong data → null', () => {
    const noDiff = { practice_question: 'Q?', choices: [], correct_choice: '', explanation: '' };
    const row = buildBankRow('math', 't', noDiff, 'algebra.linear_eq');
    assert.equal(row.difficulty, null);
  });

  test('data null/undefined → không ném, trả row tối thiểu', () => {
    const row = buildBankRow('math', 't', null, 'algebra.linear_eq');
    assert.equal(row.skill_id, 'algebra.linear_eq');
    assert.equal(row.difficulty, null);
    assert.match(row.id, /^[0-9a-f]{16}$/);
  });

  test('skillId rỗng string → coi như không có (null)', () => {
    const row = buildBankRow('math', 't', sampleData, '');
    assert.equal(row.skill_id, null);
  });

  test('không mutate object data gốc (thêm skillId ra bản sao)', () => {
    const original = { ...sampleData };
    buildBankRow('math', 't', original, 'algebra.linear_eq');
    assert.equal('skillId' in original, false);
  });

  test('MIN_POOL vẫn export (không đổi hợp đồng)', () => {
    assert.equal(typeof MIN_POOL, 'number');
  });
});
