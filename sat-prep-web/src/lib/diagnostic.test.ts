import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidSkill, getDomainOfSkill } from './skill-taxonomy.ts';

/**
 * Bộ câu diagnostic là JSON tĩnh. `diagnostic.ts` import nó qua alias `@/data/...`
 * mà node --test (type-strip) KHÔNG resolve được → test đọc thẳng file qua fs để
 * giữ module test THUẦN (bài học mistake-variant). Chỉ import TYPE-safe helper
 * thuần (skill-taxonomy) theo đường tương đối.
 */
interface DiagQ {
  id: string;
  skillId: string;
  difficulty: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  choice_analysis: { choice_letter: string; is_correct: boolean; analysis: string }[];
}

const QUESTIONS: DiagQ[] = JSON.parse(
  readFileSync(new URL('../data/diagnostic_questions.json', import.meta.url), 'utf-8')
);

const VALID_DIFFICULTY = ['Easy', 'Medium', 'Hard'];

test('bộ câu không rỗng', () => {
  assert.ok(QUESTIONS.length >= 12, `chỉ có ${QUESTIONS.length} câu, cần >= 12`);
});

test('mọi câu diagnostic có skillId hợp lệ (để /api/grade ghi mastery đúng skill)', () => {
  for (const q of QUESTIONS) {
    assert.ok(isValidSkill(q.skillId), `skillId không hợp lệ: ${q.skillId} (câu ${q.id})`);
  }
});

test('mọi câu có difficulty hợp lệ', () => {
  for (const q of QUESTIONS) {
    assert.ok(VALID_DIFFICULTY.includes(q.difficulty), `difficulty lạ: ${q.difficulty} (câu ${q.id})`);
  }
});

test('correct_choice luôn nằm trong danh sách choices', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.choices.includes(q.correct_choice), `đáp án không có trong choices (câu ${q.id})`);
  }
});

test('mỗi choice_analysis có ĐÚNG 1 is_correct và khớp chữ cái đầu của correct_choice', () => {
  for (const q of QUESTIONS) {
    const corrects = q.choice_analysis.filter((c) => c.is_correct);
    assert.equal(corrects.length, 1, `câu ${q.id} phải có đúng 1 choice_analysis is_correct`);
    const correctLetter = q.correct_choice.trim()[0].toUpperCase();
    assert.equal(
      corrects[0].choice_letter.toUpperCase(),
      correctLetter,
      `câu ${q.id}: choice_analysis đúng phải khớp letter của correct_choice`
    );
  }
});

test('choice_analysis phủ đủ mọi choice (số phân tích = số lựa chọn)', () => {
  for (const q of QUESTIONS) {
    assert.equal(q.choice_analysis.length, q.choices.length, `câu ${q.id}: thiếu phân tích cho vài lựa chọn`);
  }
});

test('id các câu là duy nhất', () => {
  const ids = QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, 'có id trùng trong bộ câu diagnostic');
});

test('phủ các domain Cambridge chính (reading/vocabulary/grammar/listening/writing)', () => {
  const domains = new Set(QUESTIONS.map((q) => getDomainOfSkill(q.skillId)?.id));
  for (const d of ['reading', 'vocabulary', 'grammar', 'listening', 'writing']) {
    assert.ok(domains.has(d), `chưa phủ domain: ${d}`);
  }
});

test('ưu tiên reading (kỹ năng free) — có ít nhất 3 câu reading', () => {
  const readingCount = QUESTIONS.filter((q) => getDomainOfSkill(q.skillId)?.id === 'reading').length;
  assert.ok(readingCount >= 3, `reading chỉ có ${readingCount} câu, cần >= 3`);
});
