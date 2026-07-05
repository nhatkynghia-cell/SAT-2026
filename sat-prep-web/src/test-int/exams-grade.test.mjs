/**
 * INTEGRATION — /api/exams/grade (nộp bài thi, ROOT A đường thi).
 * Bất biến tiền: chấm từng câu server-side (CAS) · thưởng theo ĐỘ KHÓ THẬT từng
 * câu đúng · replay/nộp lại KHÔNG cộng thêm · client không khai correctCount/số xu.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/exams/grade/route';

function seedUser(id, coins = 100) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}
function seedQ(id, userId, correct, difficulty) {
  seed('issued_questions', {
    id, user_id: userId, correct_choice: correct, skill_id: null,
    difficulty, answered: false, was_correct: null, context: null,
  });
}

test('exams/grade: 2/3 đúng → thưởng theo độ khó THẬT các câu đúng', async () => {
  resetDb(); setCurrentUser({ id: 'x-mix' }); seedUser('x-mix');
  seedQ('q1', 'x-mix', 'A', 'Easy');   // đúng → +5/+20
  seedQ('q2', 'x-mix', 'B', 'Hard');   // đúng → +20/+100
  seedQ('q3', 'x-mix', 'C', 'Medium'); // SAI

  const { status, body } = await readRes(await POST(postJson({ answers: [
    { questionId: 'q1', answer: 'A' },
    { questionId: 'q2', answer: 'B' },
    { questionId: 'q3', answer: 'D' },
  ] })));
  assert.equal(status, 200);
  assert.equal(body.correct, 2);
  assert.equal(body.graded, 3);
  assert.deepEqual(body.granted, { coins: 25, xp: 120 }); // 5+20, 20+100
  assert.equal(getRows('user_economy')[0].coins, 125);
});

test('exams/grade: nộp lại (replay) → câu đã chấm bỏ qua, KHÔNG cộng thêm', async () => {
  resetDb(); setCurrentUser({ id: 'x-replay' }); seedUser('x-replay');
  seedQ('q1', 'x-replay', 'A', 'Hard');

  await readRes(await POST(postJson({ answers: [{ questionId: 'q1', answer: 'A' }] })));
  assert.equal(getRows('user_economy')[0].coins, 120);

  const r2 = await readRes(await POST(postJson({ answers: [{ questionId: 'q1', answer: 'A' }] })));
  assert.equal(r2.body.graded, 0, 'câu đã answered → không chấm lại');
  assert.deepEqual(r2.body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 120, 'không double-grant');
});

test('exams/grade: câu của user KHÁC bị trộn vào → bỏ qua, chỉ tính câu sở hữu', async () => {
  resetDb(); setCurrentUser({ id: 'x-own' }); seedUser('x-own');
  seedQ('mine', 'x-own', 'A', 'Medium');   // đúng → +10/+50
  seedQ('victim', 'x-other', 'B', 'Hard'); // của người khác

  const { body } = await readRes(await POST(postJson({ answers: [
    { questionId: 'mine', answer: 'A' },
    { questionId: 'victim', answer: 'B' },
  ] })));
  assert.equal(body.graded, 1, 'chỉ chấm câu sở hữu');
  assert.equal(body.correct, 1);
  assert.deepEqual(body.granted, { coins: 10, xp: 50 });
});

test('exams/grade: answers rỗng → granted 0, 200', async () => {
  resetDb(); setCurrentUser({ id: 'x-empty' }); seedUser('x-empty');
  const { status, body } = await readRes(await POST(postJson({ answers: [] })));
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
});

test('exams/grade: client KHÔNG khai được correctCount — chỉ đáp án server chấm mới tính', async () => {
  resetDb(); setCurrentUser({ id: 'x-forge' }); seedUser('x-forge');
  seedQ('q1', 'x-forge', 'A', 'Easy'); // đúng đáp án là A

  // Kẻ tấn công gửi correctCount/granted khổng lồ + trả lời SAI → server phớt lờ.
  const { body } = await readRes(await POST(postJson({
    answers: [{ questionId: 'q1', answer: 'Z' }],
    correctCount: 999, granted: { coins: 1e9, xp: 1e9 },
  })));
  assert.equal(body.correct, 0);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100);
});
