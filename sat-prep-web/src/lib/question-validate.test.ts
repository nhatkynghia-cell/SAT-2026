import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion } from './question-validate.ts';

const good = {
  practice_question: 'What is the opposite of "big"?',
  choices: ['A) small', 'B) huge', 'C) tall', 'D) wide'],
  correct_choice: 'A) small',
  difficulty: 'Easy',
  choice_analysis: [
    { choice_letter: 'A', is_correct: true, analysis: 'Đúng: small = nhỏ, trái nghĩa big.' },
    { choice_letter: 'B', is_correct: false, analysis: 'huge = to lớn, đồng nghĩa big.' },
    { choice_letter: 'C', is_correct: false, analysis: 'tall = cao, không phải trái nghĩa.' },
    { choice_letter: 'D', is_correct: false, analysis: 'wide = rộng, không phải trái nghĩa.' },
  ],
};

test('câu hợp lệ → ok', () => {
  const r = validateQuestion(good);
  assert.equal(r.ok, true, r.reasons.join('; '));
  assert.deepEqual(r.reasons, []);
});

test('practice_question rỗng → fail', () => {
  const r = validateQuestion({ ...good, practice_question: '  ' });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('practice_question')));
});

test('< 2 choices → fail sớm', () => {
  const r = validateQuestion({ ...good, choices: ['A) only'] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('≥2')));
});

test('lựa chọn rỗng → fail', () => {
  const r = validateQuestion({ ...good, choices: ['A) small', 'B) ', 'C) tall', 'D) wide'] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('rỗng')));
});

test('lựa chọn TRÙNG nội dung → fail', () => {
  const r = validateQuestion({ ...good, choices: ['A) small', 'B) small', 'C) tall', 'D) wide'] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('TRÙNG')));
});

test('correct_choice không nằm trong choices → fail', () => {
  const r = validateQuestion({ ...good, correct_choice: 'E) tiny' });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('KHÔNG nằm trong choices')));
});

test('choice_analysis 2 đáp án đúng → fail (chống ghi nhớ SAI)', () => {
  const bad = {
    ...good,
    choice_analysis: good.choice_analysis.map((c, i) => (i <= 1 ? { ...c, is_correct: true } : c)),
  };
  const r = validateQuestion(bad);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('is_correct')));
});

test('choice_analysis đúng letter lệch correct_choice → fail', () => {
  const bad = {
    ...good,
    correct_choice: 'A) small',
    choice_analysis: [
      { choice_letter: 'A', is_correct: false, analysis: '...' },
      { choice_letter: 'B', is_correct: true, analysis: '...' }, // đánh dấu B đúng nhưng correct là A
      { choice_letter: 'C', is_correct: false, analysis: '...' },
      { choice_letter: 'D', is_correct: false, analysis: '...' },
    ],
  };
  const r = validateQuestion(bad);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('lệch correct_choice')));
});

test('choice_analysis không phủ hết choices → fail', () => {
  const r = validateQuestion({ ...good, choice_analysis: good.choice_analysis.slice(0, 3) });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('không phủ hết')));
});

test('difficulty lạ → fail', () => {
  const r = validateQuestion({ ...good, difficulty: 'SIÊU KHÓ' });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('difficulty')));
});

test('câu không có choice_analysis (bank cũ) vẫn ok nếu MC hợp lệ', () => {
  const r = validateQuestion({
    practice_question: 'Pick one',
    choices: ['A) x', 'B) y'],
    correct_choice: 'A) x',
  });
  assert.equal(r.ok, true, r.reasons.join('; '));
});
