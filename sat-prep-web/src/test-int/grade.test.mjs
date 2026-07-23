/**
 * INTEGRATION — /api/grade (đường thưởng 1 câu luyện tập, ROOT A).
 * Chạy THẬT route + economy-store + mastery + issued-questions (CAS) trên fake DB.
 * Bất biến tiền: chấm từ đáp án server · cộng đúng 1 lần · replay không double-grant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/grade/route';

function seedUser(id, coins = 100) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}
function seedQuestion(id, userId, correct, opts = {}) {
  seed('issued_questions', {
    id, user_id: userId, correct_choice: correct,
    skill_id: opts.skillId ?? 'algebra.linear_eq',
    difficulty: opts.difficulty ?? 'Medium',
    answered: false, was_correct: null, context: opts.context ?? null,
  });
}

test('grade: đúng → 200, thưởng theo độ khó, cộng xu 1 lần + ghi mastery', async () => {
  resetDb(); setCurrentUser({ id: 'g-ok' });
  seedUser('g-ok'); seedQuestion('q', 'g-ok', 'B', { difficulty: 'Hard' });

  const { status, body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B' })));
  assert.equal(status, 200);
  assert.equal(body.correct, true);
  assert.deepEqual(body.granted, { coins: 20, xp: 100 });
  assert.equal(getRows('user_economy')[0].coins, 120);

  // mastery ghi đúng skill (attempts+1, correct+1)
  const m = getRows('user_mastery')[0];
  assert.ok(m, 'có row mastery');
  assert.equal(m.skills['algebra.linear_eq'].attempts, 1);
  assert.equal(m.skills['algebra.linear_eq'].correct, 1);
});

test('grade: sai → 200, granted 0, KHÔNG cộng xu, mastery attempts+1 correct+0', async () => {
  resetDb(); setCurrentUser({ id: 'g-wrong' });
  seedUser('g-wrong'); seedQuestion('q', 'g-wrong', 'B', { difficulty: 'Hard' });

  const { status, body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'A' })));
  assert.equal(status, 200);
  assert.equal(body.correct, false);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100);
  const m = getRows('user_mastery')[0];
  assert.equal(m.skills['algebra.linear_eq'].attempts, 1);
  assert.equal(m.skills['algebra.linear_eq'].correct, 0);
});

test('grade: replay câu đã chấm → 404, KHÔNG cộng xu lần 2 (CAS)', async () => {
  resetDb(); setCurrentUser({ id: 'g-replay' });
  seedUser('g-replay'); seedQuestion('q', 'g-replay', 'C', { difficulty: 'Easy' });

  await readRes(await POST(postJson({ questionId: 'q', answer: 'C' })));
  assert.equal(getRows('user_economy')[0].coins, 105); // Easy = +5

  const r2 = await readRes(await POST(postJson({ questionId: 'q', answer: 'C' })));
  assert.equal(r2.status, 404);
  assert.equal(getRows('user_economy')[0].coins, 105, 'không cộng lần 2');
});

test('grade: questionId không tồn tại → 404', async () => {
  resetDb(); setCurrentUser({ id: 'g-forge' }); seedUser('g-forge');
  const { status } = await readRes(await POST(postJson({ questionId: 'ghost', answer: 'A' })));
  assert.equal(status, 404);
});

test('grade: câu của user KHÁC → 404 (ownership), không cộng xu', async () => {
  resetDb(); setCurrentUser({ id: 'g-attacker' });
  seedUser('g-attacker'); seedQuestion('victimQ', 'g-victim', 'A');

  const { status } = await readRes(await POST(postJson({ questionId: 'victimQ', answer: 'A' })));
  assert.equal(status, 404);
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('grade: thiếu questionId/answer → 400', async () => {
  resetDb(); setCurrentUser({ id: 'g-400' }); seedUser('g-400');
  assert.equal((await readRes(await POST(postJson({ answer: 'A' })))).status, 400);
  assert.equal((await readRes(await POST(postJson({ questionId: 'x' })))).status, 400);
});

test('grade: client KHÔNG gửi được số xu — payload isCorrect/granted bị bỏ qua', async () => {
  resetDb(); setCurrentUser({ id: 'g-inject' });
  seedUser('g-inject'); seedQuestion('q', 'g-inject', 'B', { difficulty: 'Easy' });

  // Kẻ tấn công nhét coins/isCorrect/granted vào body — server phải phớt lờ.
  const { body } = await readRes(await POST(postJson({
    questionId: 'q', answer: 'A', // trả lời SAI
    isCorrect: true, coins: 999999, granted: { coins: 999999, xp: 999999 },
  })));
  assert.equal(body.correct, false, 'server tự chấm, không tin client');
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('grade: combo streak client gửi bị bỏ qua — không bơm thưởng', async () => {
  resetDb(); setCurrentUser({ id: 'g-combo' });
  seedUser('g-combo'); seedQuestion('q', 'g-combo', 'B', { difficulty: 'Hard' });

  // Kẻ tấn công gửi streak khổng lồ. Server KHÔNG tin streak client trên đường tiền,
  // nên vẫn trả thưởng cơ bản Hard 20/100. Combo chỉ bật lại khi có streak server-authoritative.
  const { body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B', streak: 999999 })));
  assert.equal(body.correct, true);
  assert.deepEqual(body.granted, { coins: 20, xp: 100 }, 'streak client bị bỏ qua → base Hard');
  assert.equal(getRows('user_economy')[0].coins, 120);
});

test('grade: streak âm/không hợp lệ → coi như 0, thưởng cơ bản (không combo)', async () => {
  resetDb(); setCurrentUser({ id: 'g-negstreak' });
  seedUser('g-negstreak'); seedQuestion('q', 'g-negstreak', 'B', { difficulty: 'Hard' });
  const { body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B', streak: -50 })));
  assert.deepEqual(body.granted, { coins: 20, xp: 100 }, 'streak âm → 0 → base Hard');
});

// ── COMBO SERVER-AUTHORITATIVE (bump_answer_streak) ──────────────────────────
// streak SERVER tăng theo chuỗi đúng liên tiếp → comboMultiplier bật ở ngưỡng
// 5/10/15. Mỗi câu 1 issued_questions riêng (CAS answered), server tự đếm streak.

test('grade: combo — câu đúng thứ 5 liên tiếp → ×1.25 (Medium 10/50 → 12/62)', async () => {
  resetDb(); setCurrentUser({ id: 'g-combo5' }); seedUser('g-combo5');
  // 5 câu Medium đúng liên tiếp. Câu 1-4: streak 1-4 (×1.0 → 10/50). Câu 5: streak 5 (×1.25).
  for (let i = 1; i <= 5; i++) seedQuestion(`q${i}`, 'g-combo5', 'B', { difficulty: 'Medium' });
  let last;
  for (let i = 1; i <= 5; i++) {
    last = (await readRes(await POST(postJson({ questionId: `q${i}`, answer: 'B' })))).body;
  }
  // Câu thứ 5: streak=5 → ×1.25 → coins floor(10*1.25)=12, xp floor(50*1.25)=62.
  assert.deepEqual(last.granted, { coins: 12, xp: 62 }, 'câu thứ 5 combo ×1.25');
});

test('grade: combo RESET khi trả lời sai giữa chừng', async () => {
  resetDb(); setCurrentUser({ id: 'g-comboReset' }); seedUser('g-comboReset');
  // 4 câu đúng (streak lên 4), 1 câu SAI (reset 0), rồi 1 câu đúng (streak lại 1 → ×1.0).
  for (let i = 1; i <= 4; i++) seedQuestion(`ok${i}`, 'g-comboReset', 'B', { difficulty: 'Medium' });
  seedQuestion('wrong', 'g-comboReset', 'B', { difficulty: 'Medium' });
  seedQuestion('after', 'g-comboReset', 'B', { difficulty: 'Medium' });

  for (let i = 1; i <= 4; i++) await readRes(await POST(postJson({ questionId: `ok${i}`, answer: 'B' })));
  await readRes(await POST(postJson({ questionId: 'wrong', answer: 'A' }))); // SAI → reset
  const after = (await readRes(await POST(postJson({ questionId: 'after', answer: 'B' })))).body;
  // Sau reset, câu đúng kế tiếp streak=1 → ×1.0 → base Medium 10/50 (KHÔNG cộng dồn combo cũ).
  assert.deepEqual(after.granted, { coins: 10, xp: 50 }, 'combo reset về base sau khi sai');
});

test('grade: combo — câu đầu tiên streak=1 → base (không combo, client streak bị bỏ qua)', async () => {
  resetDb(); setCurrentUser({ id: 'g-first' }); seedUser('g-first');
  seedQuestion('q', 'g-first', 'B', { difficulty: 'Hard' });
  // Dù client gửi streak khổng lồ, server đếm streak=1 (câu đầu) → ×1.0 → base Hard.
  const { body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B', streak: 999 })));
  assert.deepEqual(body.granted, { coins: 20, xp: 100 }, 'câu đầu → streak server=1 → base');
});

// ── HẾT GIỜ TỰ NỘP (đề thư viện): answer rỗng chấm sai, KHÔNG có lỗ farm ──────

test('grade: answer rỗng "" (hết giờ chưa chọn) → 200, chấm SAI, 0 thưởng, vẫn CAS + lộ đáp án', async () => {
  resetDb(); setCurrentUser({ id: 'g-empty' });
  seedUser('g-empty'); seedQuestion('q', 'g-empty', 'B', { difficulty: 'Hard' });

  const { status, body } = await readRes(await POST(postJson({ questionId: 'q', answer: '' })));
  assert.equal(status, 200);
  assert.equal(body.correct, false, 'rỗng không bao giờ khớp đáp án → sai');
  assert.deepEqual(body.granted, { coins: 0, xp: 0 }, 'không thưởng → không có lỗ farm');
  assert.equal(body.correctChoice, 'B', 'lộ đáp án đúng sau nộp');
  assert.equal(getRows('user_economy')[0].coins, 100);
  // CAS đã lật answered → replay bị chặn
  assert.equal(getRows('issued_questions')[0].answered, true);
});

test('grade: sau nộp rỗng → replay → 404 (đã CAS, không farm được)', async () => {
  resetDb(); setCurrentUser({ id: 'g-empty2' });
  seedUser('g-empty2'); seedQuestion('q', 'g-empty2', 'B');

  await readRes(await POST(postJson({ questionId: 'q', answer: '' })));
  const r2 = await readRes(await POST(postJson({ questionId: 'q', answer: 'B' })));
  assert.equal(r2.status, 404, 'câu đã nộp rỗng → không chấm lại được');
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('grade: answer THIẾU hẳn (không phải rỗng) → vẫn 400', async () => {
  resetDb(); setCurrentUser({ id: 'g-noans' });
  seedUser('g-noans'); seedQuestion('q', 'g-noans', 'B');
  const { status } = await readRes(await POST(postJson({ questionId: 'q' })));
  assert.equal(status, 400, 'undefined answer → 400 (chỉ chuỗi rỗng mới hợp lệ)');
});

// ── GIẢI THÍCH lộ sau khi nộp (đề thư viện lưu exp trong context) ────────────

test('grade: câu có explanation trong context → trả explanation sau nộp', async () => {
  resetDb(); setCurrentUser({ id: 'g-exp' });
  seedUser('g-exp');
  seedQuestion('q', 'g-exp', 'B', {
    difficulty: 'Medium',
    context: JSON.stringify({ src: 'library', exp: 'Vì B là đáp án đúng do...' }),
  });

  const { body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B' })));
  assert.equal(body.explanation, 'Vì B là đáp án đúng do...', 'lộ lời giải sau khi nộp');
});

test('grade: câu KHÔNG có explanation → explanation null (backward-compatible)', async () => {
  resetDb(); setCurrentUser({ id: 'g-noexp' });
  seedUser('g-noexp'); seedQuestion('q', 'g-noexp', 'B'); // context = null
  const { body } = await readRes(await POST(postJson({ questionId: 'q', answer: 'B' })));
  assert.equal(body.explanation, null, 'câu cũ/không lưu exp → null, không vỡ');
});
