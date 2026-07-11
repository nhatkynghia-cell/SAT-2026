/**
 * INTEGRATION — /api/exam-session/submit (nộp module thi adaptive, ROOT A/C).
 * Trọng tâm: NỘP LẠI IDEMPOTENT (adversarial review wf_4e1ca5c7 phát hiện 2 HIGH):
 * khi client retry sau khi response mất giữa đường, server ĐÃ chấm (CAS tiêu) →
 * điểm KHÔNG được mất + adaptive path KHÔNG bị hạ về easy, NHƯNG thưởng KHÔNG cộng
 * lại. Dùng moduleNum:2 (chỉ chấm, không sinh module → không cần OpenAI).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/exam-session/submit/route';

function seedUser(id, coins = 100) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}
function seedQ(id, userId, correct, difficulty) {
  seed('issued_questions', {
    id, user_id: userId, correct_choice: correct, skill_id: null,
    difficulty, answered: false, was_correct: null, context: null,
  });
}

test('exam-submit M2: chấm đúng số câu + thưởng theo độ khó', async () => {
  resetDb(); setCurrentUser({ id: 's-ok' }); seedUser('s-ok');
  seedQ('q1', 's-ok', 'A', 'Easy');   // đúng → +5/+20
  seedQ('q2', 's-ok', 'B', 'Hard');   // đúng → +20/+100
  seedQ('q3', 's-ok', 'C', 'Medium'); // SAI

  const { status, body } = await readRes(await POST(postJson({
    section: 'math', moduleNum: 2, mode: 'mock',
    answers: [
      { questionId: 'q1', answer: 'A' },
      { questionId: 'q2', answer: 'B' },
      { questionId: 'q3', answer: 'D' },
    ],
  })));
  assert.equal(status, 200);
  assert.equal(body.moduleResult.correct, 2);
  assert.deepEqual(body.granted, { coins: 25, xp: 120 });
  assert.equal(getRows('user_economy')[0].coins, 125);
});

// 🔴 REGRESSION HIGH #1+#2: retry sau khi server ĐÃ chấm (response mất giữa đường).
// gradeAnswer trả null (CAS đã tiêu) NHƯNG getGradedResult đọc was_correct đã lưu →
// correct VẪN đếm đúng (không mất điểm, adaptive path không hạ về easy) + granted=0.
test('exam-submit: NỘP LẠI → điểm giữ nguyên (idempotent), KHÔNG double-grant', async () => {
  resetDb(); setCurrentUser({ id: 's-retry' }); seedUser('s-retry');
  seedQ('q1', 's-retry', 'A', 'Hard');
  seedQ('q2', 's-retry', 'B', 'Hard');

  const payload = {
    section: 'math', moduleNum: 2, mode: 'mock',
    answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q2', answer: 'B' }],
  };

  // Lần 1: chấm mới → 2 đúng, thưởng, coins 100→140 (2×Hard = +40).
  const r1 = await readRes(await POST(postJson(payload)));
  assert.equal(r1.body.moduleResult.correct, 2, 'lần 1: 2 câu đúng');
  assert.equal(getRows('user_economy')[0].coins, 140);

  // Lần 2 (retry, cùng answers): điểm VẪN 2 (đọc was_correct đã lưu) — KHÔNG mất
  // điểm — nhưng KHÔNG thưởng lại.
  const r2 = await readRes(await POST(postJson(payload)));
  assert.equal(r2.body.moduleResult.correct, 2, 'RETRY: điểm giữ nguyên, KHÔNG về 0');
  assert.deepEqual(r2.body.granted, { coins: 0, xp: 0 }, 'RETRY: không thưởng lại');
  assert.equal(getRows('user_economy')[0].coins, 140, 'RETRY: coins không đổi (no double-grant)');
});

// Adaptive path Module 1 dựa trên correct — retry phải giữ correct để không hạ nhánh.
// (Test gián tiếp qua moduleResult.correct đã đủ: determineAdaptivePath(correct) là
// hàm thuần của correct → correct đúng ⇒ path đúng.)
test('exam-submit: câu của user KHÁC trộn vào → bỏ qua', async () => {
  resetDb(); setCurrentUser({ id: 's-own' }); seedUser('s-own');
  seedQ('mine', 's-own', 'A', 'Medium');
  seedQ('victim', 's-other', 'B', 'Hard');

  const { body } = await readRes(await POST(postJson({
    section: 'math', moduleNum: 2, mode: 'mock',
    answers: [{ questionId: 'mine', answer: 'A' }, { questionId: 'victim', answer: 'B' }],
  })));
  assert.equal(body.moduleResult.correct, 1, 'chỉ tính câu sở hữu');
  assert.equal(body.moduleResult.total, 1, 'mẫu số = câu SỞ HỮU server chấm (loại câu user khác)');
  assert.deepEqual(body.granted, { coins: 10, xp: 50 });
});

// #2: câu BỎ TRẮNG (answer='') tính vào MẪU SỐ (total) nhưng KHÔNG tính đúng.
// Client gửi mọi câu phát (câu chưa trả lời → answer=''); server chấm rỗng=sai →
// điểm /1600 (client rawToScaled(raw, total, path)) không bị thổi phồng do câu
// trắng lọt khỏi mẫu số như trước (total cũ = answers.length client tự lọc).
test('exam-submit: câu bỏ trắng đếm vào total (mẫu số) nhưng KHÔNG là câu đúng', async () => {
  resetDb(); setCurrentUser({ id: 's-blank' }); seedUser('s-blank');
  seedQ('b1', 's-blank', 'A', 'Medium'); // đúng
  seedQ('b2', 's-blank', 'B', 'Hard');   // bỏ trắng → sai
  seedQ('b3', 's-blank', 'C', 'Easy');   // bỏ trắng → sai

  const { body } = await readRes(await POST(postJson({
    section: 'math', moduleNum: 2, mode: 'mock',
    answers: [
      { questionId: 'b1', answer: 'A' },
      { questionId: 'b2', answer: '' },
      { questionId: 'b3', answer: '' },
    ],
  })));
  assert.equal(body.moduleResult.correct, 1, 'chỉ 1 câu đúng');
  assert.equal(body.moduleResult.total, 3, 'mẫu số = 3 (gồm 2 câu trắng), KHÔNG co lại còn 1');
  assert.deepEqual(body.granted, { coins: 10, xp: 50 }, 'câu trắng không được thưởng');
});
