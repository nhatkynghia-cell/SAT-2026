/**
 * INTEGRATION — /api/library (Thư viện đề: làm bài THẬT có tính giờ).
 * Chạy THẬT route + exams(mock_exams.json) + issued-questions trên fake DB.
 * Bất biến: GET liệt kê câu GIẤU đáp án; POST issue → questionId + timeLimit +
 * payload KHÔNG lộ correct_choice/explanation (đáp án chỉ lộ sau /api/grade).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, getRows, postJson, readRes } from './harness.mjs';
import { GET, POST } from '@/app/api/library/route';

// id đầu tiên của mock_exams.json (RW module). Dạng "<examId>::<questionId>".
const RW_ID = 'mock_sat_1::q1';
const MATH_ID = 'mock_sat_1::q3';

test('library GET: trả danh sách thẻ, mỗi thẻ đủ field + KHÔNG lộ đáp án', async () => {
  resetDb(); setCurrentUser({ id: 'lib-list' });
  const { status, body } = await readRes(await GET());
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.questions), 'trả mảng questions');
  assert.ok(body.questions.length >= 1, 'có ít nhất 1 câu');

  const card = body.questions[0];
  for (const k of ['id', 'tag', 'text', 'source', 'subject', 'difficulty']) {
    assert.ok(k in card, `thẻ có field ${k}`);
  }
  // Bất biến bảo mật: thẻ KHÔNG mang đáp án hay lời giải.
  assert.ok(!('correct_choice' in card), 'không lộ correct_choice');
  assert.ok(!('explanation' in card), 'không lộ explanation');
  // id đúng định dạng composite
  assert.ok(card.id.includes('::'), 'id dạng examId::questionId');
});

test('library GET: subject suy đúng từ tên module (RW vs Math)', async () => {
  resetDb(); setCurrentUser({ id: 'lib-subj' });
  const { body } = await readRes(await GET());
  const subjects = new Set(body.questions.map((q) => q.subject));
  // Mọi subject phải nằm trong 2 giá trị hợp lệ.
  for (const s of subjects) {
    assert.ok(s === 'Reading & Writing' || s === 'Math', `subject hợp lệ: ${s}`);
  }
});

test('library POST: issue câu → questionId + timeLimit + payload GIẤU đáp án', async () => {
  resetDb(); setCurrentUser({ id: 'lib-start' });
  const { status, body } = await readRes(await POST(postJson({ id: RW_ID })));
  assert.equal(status, 200);

  // Trả đủ 3 thành phần
  assert.ok(body.questionId, 'có questionId (server cấp)');
  assert.ok(typeof body.timeLimit === 'number' && body.timeLimit > 0, 'có timeLimit > 0');
  assert.ok(body.question, 'có question');

  // timeLimit kẹp trong [30, 300]
  assert.ok(body.timeLimit >= 30 && body.timeLimit <= 300, 'timeLimit trong [30,300]');

  // Payload câu hỏi: đủ để làm bài NHƯNG giấu đáp án
  const q = body.question;
  assert.ok(Array.isArray(q.choices) && q.choices.length >= 2, 'có mảng đáp án');
  assert.ok(q.practice_question, 'có đề bài');
  assert.ok(!('correct_choice' in q), 'KHÔNG lộ correct_choice');
  assert.equal(q.explanation, '', 'explanation rỗng (lộ sau khi nộp qua /api/grade)');

  // Đã ghi issued_questions server-side (lưu đáp án + lời giải để chấm sau)
  const issued = getRows('issued_questions');
  assert.equal(issued.length, 1, 'issue đúng 1 câu');
  assert.equal(issued[0].id, body.questionId);
  assert.ok(issued[0].correct_choice, 'đáp án lưu server-side');
  // context chứa exp (để /api/grade trả lời giải sau nộp)
  const ctx = JSON.parse(issued[0].context);
  assert.equal(ctx.src, 'library');
  assert.ok(ctx.exp, 'lưu explanation trong context');
});

test('library POST: math question cũng issue được', async () => {
  resetDb(); setCurrentUser({ id: 'lib-math' });
  const { status, body } = await readRes(await POST(postJson({ id: MATH_ID })));
  assert.equal(status, 200);
  assert.ok(body.questionId);
  assert.ok(body.question.choices.length >= 2);
});

test('library POST: id thiếu "::" → 400', async () => {
  resetDb(); setCurrentUser({ id: 'lib-bad' });
  const { status } = await readRes(await POST(postJson({ id: 'khongcodauhaicham' })));
  assert.equal(status, 400);
});

test('library POST: thiếu id → 400', async () => {
  resetDb(); setCurrentUser({ id: 'lib-noid' });
  const { status } = await readRes(await POST(postJson({})));
  assert.equal(status, 400);
});

test('library POST: examId không tồn tại → 404', async () => {
  resetDb(); setCurrentUser({ id: 'lib-noexam' });
  const { status } = await readRes(await POST(postJson({ id: 'ghost_exam::q1' })));
  assert.equal(status, 404);
});

test('library POST: questionId không tồn tại trong đề → 404', async () => {
  resetDb(); setCurrentUser({ id: 'lib-noq' });
  const { status } = await readRes(await POST(postJson({ id: 'mock_sat_1::q99999' })));
  assert.equal(status, 404);
});

test('library POST: mỗi lần bấm issue câu MỚI (questionId khác nhau)', async () => {
  resetDb(); setCurrentUser({ id: 'lib-twice' });
  const r1 = await readRes(await POST(postJson({ id: RW_ID })));
  const r2 = await readRes(await POST(postJson({ id: RW_ID })));
  assert.notEqual(r1.body.questionId, r2.body.questionId, 'issue riêng biệt mỗi lượt');
  assert.equal(getRows('issued_questions').length, 2);
});
