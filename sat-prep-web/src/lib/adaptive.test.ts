import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDifficulty, recommendNext, EASY_CEILING, HARD_FLOOR } from './adaptive.ts';
import type { MasterySummary } from './mastery.ts';

// Helper dựng MasterySummary giả từ map skillId → {score, attempts, ...}.
// Suy ra subject/moduleType từ tiền tố id để khớp taxonomy thật:
//   rw.* = reading (vocab/literature), còn lại = math.
function fakeSummary(
  entries: Record<string, { score: number; attempts: number; mastered?: boolean }>
): MasterySummary {
  const skills = Object.entries(entries).map(([id, v]) => {
    const isReading = id.startsWith('rw.');
    return {
      id,
      label: id,
      score: v.score,
      attempts: v.attempts,
      reliable: v.attempts >= 5,
      mastered: v.mastered ?? false,
      subject: (isReading ? 'reading' : 'math') as 'reading' | 'math',
      moduleType: id === 'rw.vocab' ? 'vocab' : isReading ? 'literature' : 'math',
    };
  });
  return { skills, bySubject: { math: 0, reading: 0 }, overall: 0 } as MasterySummary;
}

test('selectDifficulty: mastery thấp → Easy', () => {
  assert.equal(selectDifficulty(0), 'Easy');
  assert.equal(selectDifficulty(EASY_CEILING - 1), 'Easy');
});

test('selectDifficulty: mastery trung bình → Medium', () => {
  assert.equal(selectDifficulty(EASY_CEILING), 'Medium');
  assert.equal(selectDifficulty(HARD_FLOOR - 1), 'Medium');
});

test('selectDifficulty: mastery cao → Hard', () => {
  assert.equal(selectDifficulty(HARD_FLOOR), 'Hard');
  assert.equal(selectDifficulty(100), 'Hard');
});

test('recommendNext: chọn skill YẾU NHẤT chưa thành thạo', () => {
  const s = fakeSummary({
    'algebra.linear_eq': { score: 80, attempts: 10 },
    'geo.trig': { score: 20, attempts: 6 },       // yếu nhất
    'data.probability': { score: 50, attempts: 8 },
  });
  const rec = recommendNext(s);
  assert.ok(rec);
  assert.equal(rec.skillId, 'geo.trig');
  assert.equal(rec.difficulty, 'Easy'); // score 20 < EASY_CEILING
});

test('recommendNext: ưu tiên skill CHƯA luyện (attempts=0) khi cùng score thấp', () => {
  const s = fakeSummary({
    'algebra.linear_eq': { score: 0, attempts: 3 },
    'geo.circles': { score: 0, attempts: 0 },   // cùng score 0, ít attempts hơn
  });
  const rec = recommendNext(s);
  assert.equal(rec?.skillId, 'geo.circles');
});

test('recommendNext: lọc theo subject reading', () => {
  const s = fakeSummary({
    'algebra.linear_eq': { score: 10, attempts: 5 }, // math, yếu hơn
    'rw.vocab': { score: 60, attempts: 5 },          // reading
  });
  const rec = recommendNext(s, { subject: 'reading' });
  assert.ok(rec);
  assert.equal(rec.skillId, 'rw.vocab'); // bị lọc nên dù score cao hơn vẫn được chọn
});

test('recommendNext: đã thành thạo HẾT → vẫn trả 1 skill để ôn duy trì', () => {
  const s = fakeSummary({
    'algebra.linear_eq': { score: 90, attempts: 10, mastered: true },
    'geo.trig': { score: 85, attempts: 10, mastered: true },
  });
  const rec = recommendNext(s);
  assert.ok(rec, 'phải trả về 1 skill ôn tập, không null');
  assert.match(rec.reason, /thành thạo|duy trì/i);
});

test('recommendNext: bộ lọc moduleType không khớp gì → null', () => {
  const s = fakeSummary({ 'algebra.linear_eq': { score: 10, attempts: 5 } });
  const rec = recommendNext(s, { moduleType: 'desmos' });
  assert.equal(rec, null);
});
