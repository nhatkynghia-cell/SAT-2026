import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rawToScaled,
  determineAdaptivePath,
  computeExamScore,
  RW_M1_CUTOFF,
  MATH_M1_CUTOFF,
  type AnswerSet,
} from './exam-scoring.ts';

test('rawToScaled: sàn 200 khi 0 câu đúng (cả hard lẫn easy)', () => {
  assert.equal(rawToScaled(0, 27, 'hard'), 200);
  assert.equal(rawToScaled(0, 27, 'easy'), 200);
});

test('rawToScaled: trần 800 hard-path khi đúng hết', () => {
  assert.equal(rawToScaled(27, 27, 'hard'), 800);
});

test('rawToScaled: easy-path bị cap ~650 khi đúng hết (không thể chạm 800)', () => {
  assert.equal(rawToScaled(22, 22, 'easy'), 650);
});

test('rawToScaled: đơn điệu tăng theo số câu đúng', () => {
  let prev = -1;
  for (let c = 0; c <= 27; c++) {
    const s = rawToScaled(c, 27, 'hard');
    assert.ok(s >= prev, `điểm phải không giảm: ${c} câu → ${s} < ${prev}`);
    prev = s;
  }
});

test('rawToScaled: cùng số câu đúng, hard-path >= easy-path', () => {
  for (const c of [5, 10, 15, 22]) {
    assert.ok(rawToScaled(c, 22, 'hard') >= rawToScaled(c, 22, 'easy'));
  }
});

test('rawToScaled: bội số 10 (thang điểm SAT thật)', () => {
  for (const c of [3, 7, 13, 19, 25]) {
    assert.equal(rawToScaled(c, 27, 'hard') % 10, 0);
  }
});

test('rawToScaled: tổng điểm nằm trong 400..1600 cho mọi tổ hợp', () => {
  for (const rw of [0, 13, 27]) {
    for (const m of [0, 11, 22]) {
      const total = rawToScaled(rw, 27, 'hard') + rawToScaled(m, 22, 'hard');
      assert.ok(total >= 400 && total <= 1600, `total ${total} ngoài thang`);
    }
  }
});

test('determineAdaptivePath: RW đạt cutoff → hard, dưới → easy', () => {
  assert.equal(determineAdaptivePath(RW_M1_CUTOFF, 'rw'), 'hard');
  assert.equal(determineAdaptivePath(RW_M1_CUTOFF - 1, 'rw'), 'easy');
});

test('determineAdaptivePath: Math đạt cutoff → hard, dưới → easy', () => {
  assert.equal(determineAdaptivePath(MATH_M1_CUTOFF, 'math'), 'hard');
  assert.equal(determineAdaptivePath(MATH_M1_CUTOFF - 1, 'math'), 'easy');
});

// computeExamScore chấm bằng so khớp chữ cái đầu (A/B/C/D) — dùng cho hiển thị.
function set(pairs: [string, string, string][]): AnswerSet {
  const answers: Record<string, string> = {};
  const correctAnswers: Record<string, string> = {};
  for (const [id, user, correct] of pairs) {
    answers[id] = user;
    correctAnswers[id] = correct;
  }
  return { answers, correctAnswers };
}

test('computeExamScore: khớp theo chữ cái đầu, cộng đúng 2 phần', () => {
  const rwM1 = set([['q1', 'B) x', 'B) y'], ['q2', 'A) x', 'C) z']]); // 1/2
  const rwM2 = set([['q3', 'D) a', 'D) b']]);                          // 1/1
  const mathM1 = set([['q4', 'C) 1', 'C) 2']]);                        // 1/1
  const mathM2 = set([['q5', 'A) 1', 'B) 2']]);                        // 0/1
  const res = computeExamScore(rwM1, rwM2, mathM1, mathM2, 'hard', 'easy');
  assert.equal(res.rw.raw, 2);
  assert.equal(res.rw.total, 3);
  assert.equal(res.math.raw, 1);
  assert.equal(res.math.total, 2);
  assert.equal(res.total, res.rw.scaled + res.math.scaled);
});
