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

test('determineAdaptivePath: RW module đầy đủ giữ điểm gãy cũ (18/27 hard, 17/27 easy)', () => {
  assert.equal(determineAdaptivePath(RW_M1_CUTOFF, 27, 'rw'), 'hard');
  assert.equal(determineAdaptivePath(RW_M1_CUTOFF - 1, 27, 'rw'), 'easy');
});

test('determineAdaptivePath: Math module đầy đủ giữ điểm gãy cũ (15/22 hard, 14/22 easy)', () => {
  assert.equal(determineAdaptivePath(MATH_M1_CUTOFF, 22, 'math'), 'hard');
  assert.equal(determineAdaptivePath(MATH_M1_CUTOFF - 1, 22, 'math'), 'easy');
});

test('determineAdaptivePath: module SINH THIẾU câu vẫn route theo tỉ lệ (đúng gần hết → hard)', () => {
  // Bug cũ: M1 chỉ sinh được 10 câu (OpenAI hiccup), đúng 9/10 = 90% → tuyệt đối
  // 9 < 18 nên bị ép easy (trần 650) dù rõ ràng trình hard. Giờ 0.9 >= 0.667 → hard.
  assert.equal(determineAdaptivePath(9, 10, 'rw'), 'hard');
  assert.equal(determineAdaptivePath(8, 11, 'math'), 'hard'); // 0.727 >= 0.682
});

test('determineAdaptivePath: module thiếu câu nhưng tỉ lệ dưới ngưỡng → easy', () => {
  assert.equal(determineAdaptivePath(5, 10, 'rw'), 'easy');   // 0.5 < 0.667
  assert.equal(determineAdaptivePath(6, 10, 'math'), 'easy'); // 0.6 < 0.682
});

test('determineAdaptivePath: đúng ngưỡng chính xác (>=) → hard', () => {
  assert.equal(determineAdaptivePath(2, 3, 'rw'), 'hard');   // 0.667 >= 0.667
  assert.equal(determineAdaptivePath(15, 22, 'math'), 'hard');
});

test('determineAdaptivePath: totalCount 0 (không chấm được câu nào) → easy an toàn', () => {
  assert.equal(determineAdaptivePath(0, 0, 'rw'), 'easy');
  assert.equal(determineAdaptivePath(5, 0, 'math'), 'easy'); // mẫu số 0 dù correct>0
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
