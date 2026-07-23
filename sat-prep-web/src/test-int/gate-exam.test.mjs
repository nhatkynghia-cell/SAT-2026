/**
 * INTEGRATION — /api/gate-exam POST (chấm đề thi cổng, ROOT A + audit 2026-07-20).
 * Bất biến: điểm chỉ đếm câu ĐÚNG trong bộ questionIds client nộp + src='gate';
 * KHÔNG dùng câu gate CŨ ngoài attempt; yêu cầu đúng GATE_QUESTIONS câu; re-check
 * eligibility server-side (domainAvg>=40 + gate chưa pass).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/gate-exam/route';

const DOMAIN = 'algebra';
const SKILL = 'algebra.linear_eq';

/** Seed mastery đủ ngưỡng (domainAvg>=40) cho 4 skill algebra. */
function seedEligibleMastery(userId, score = 60) {
  seed('user_mastery', {
    user_id: userId,
    skills: {
      'algebra.linear_eq': { score, attempts: 10, correct: 8 },
      'algebra.linear_fn': { score, attempts: 10, correct: 8 },
      'algebra.systems': { score, attempts: 10, correct: 8 },
      'algebra.inequalities': { score, attempts: 10, correct: 8 },
    },
  });
}

/** Seed 1 câu đã chấm (answered) với was_correct + src. */
function seedGraded(id, userId, wasCorrect, src = 'gate') {
  seed('issued_questions', {
    id,
    user_id: userId,
    correct_choice: 'A',
    skill_id: SKILL,
    difficulty: 'Hard',
    answered: true,
    was_correct: wasCorrect,
    context: JSON.stringify({ src }),
  });
}

test('gate-exam POST: 4/5 câu gate đúng trong bộ questionIds → passed', async () => {
  resetDb(); setCurrentUser({ id: 'gate-pass' });
  seedEligibleMastery('gate-pass');
  const ids = ['g1', 'g2', 'g3', 'g4', 'g5'];
  seedGraded('g1', 'gate-pass', true);
  seedGraded('g2', 'gate-pass', true);
  seedGraded('g3', 'gate-pass', true);
  seedGraded('g4', 'gate-pass', true);
  seedGraded('g5', 'gate-pass', false);

  const { status, body } = await readRes(await POST(postJson({ domain: DOMAIN, questionIds: ids })));
  assert.equal(status, 200);
  assert.equal(body.result.passed, true);
  assert.equal(body.result.score, 4);
});

test('gate-exam POST: câu gate CŨ ngoài questionIds KHÔNG được tính (chống pass bằng câu cũ)', async () => {
  resetDb(); setCurrentUser({ id: 'gate-old' });
  seedEligibleMastery('gate-old');
  // 5 câu cũ đúng nhưng KHÔNG nằm trong bộ nộp.
  for (const id of ['old1', 'old2', 'old3', 'old4', 'old5']) seedGraded(id, 'gate-old', true);
  // Bộ nộp là 5 câu attempt mới, chỉ 2 đúng.
  const ids = ['n1', 'n2', 'n3', 'n4', 'n5'];
  seedGraded('n1', 'gate-old', true);
  seedGraded('n2', 'gate-old', true);
  seedGraded('n3', 'gate-old', false);
  seedGraded('n4', 'gate-old', false);
  seedGraded('n5', 'gate-old', false);

  const { status, body } = await readRes(await POST(postJson({ domain: DOMAIN, questionIds: ids })));
  assert.equal(status, 200);
  assert.equal(body.result.score, 2, 'chỉ đếm câu đúng trong bộ nộp');
  assert.equal(body.result.passed, false, 'không pass bằng câu gate cũ');
});

test('gate-exam POST: câu src KHÁC gate (vd bank) trong bộ nộp KHÔNG tính', async () => {
  resetDb(); setCurrentUser({ id: 'gate-src' });
  seedEligibleMastery('gate-src');
  const ids = ['s1', 's2', 's3', 's4', 's5'];
  seedGraded('s1', 'gate-src', true, 'gate');
  seedGraded('s2', 'gate-src', true, 'gate');
  seedGraded('s3', 'gate-src', true, 'bank');  // đúng nhưng src bank → không tính
  seedGraded('s4', 'gate-src', true, 'bank');
  seedGraded('s5', 'gate-src', true, 'ai');

  const { body } = await readRes(await POST(postJson({ domain: DOMAIN, questionIds: ids })));
  assert.equal(body.result.score, 2, 'chỉ câu src=gate mới tính');
});

test('gate-exam POST: thiếu đúng số câu (không đủ GATE_QUESTIONS) → 400', async () => {
  resetDb(); setCurrentUser({ id: 'gate-short' });
  seedEligibleMastery('gate-short');
  const { status } = await readRes(await POST(postJson({ domain: DOMAIN, questionIds: ['a', 'b', 'c'] })));
  assert.equal(status, 400);
});

test('gate-exam POST: chưa đủ mastery (domainAvg<40) → 403, KHÔNG lưu gate', async () => {
  resetDb(); setCurrentUser({ id: 'gate-low' });
  seedEligibleMastery('gate-low', 20); // dưới ngưỡng 40
  const ids = ['x1', 'x2', 'x3', 'x4', 'x5'];
  for (const id of ids) seedGraded(id, 'gate-low', true);

  const { status } = await readRes(await POST(postJson({ domain: DOMAIN, questionIds: ids })));
  assert.equal(status, 403);
});

test('gate-exam POST: domain không hợp lệ → 400', async () => {
  resetDb(); setCurrentUser({ id: 'gate-bad' });
  const { status } = await readRes(await POST(postJson({ domain: 'khong-ton-tai', questionIds: ['a', 'b', 'c', 'd', 'e'] })));
  assert.equal(status, 400);
});
