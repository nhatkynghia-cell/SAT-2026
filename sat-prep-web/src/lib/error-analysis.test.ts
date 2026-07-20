import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyError,
  aggregateErrors,
  weakSubjects,
  ERROR_TAGS,
  type MistakeEntry,
} from './error-analysis.ts';

/**
 * Test error-analysis — tối ưu #7 (phần THUẦN, không I/O DB).
 *  classifyError / aggregateErrors / weakSubjects — heuristic + aggregate thuần.
 */

/** Dựng MistakeEntry tối thiểu (required fields default rỗng, partial ghi đè). */
function mk(partial: Partial<MistakeEntry>): MistakeEntry {
  return {
    question: '',
    choices: [],
    correct_choice: '',
    user_choice: '',
    ...partial,
  };
}

// ---------- classifyError ----------

test('classifyError: skill grammar.a2 + keyword "ngữ pháp/thì" → grammar', () => {
  const e = mk({
    skill_id: 'grammar.a2',
    question: 'Chọn thì đúng của động từ trong ngoặc.',
    explanation: 'Sai ngữ pháp: cần thì hiện tại đơn.',
  });
  assert.equal(classifyError(e), 'grammar');
});

test('classifyError: skill vocabulary.b1 + keyword "từ vựng" → vocab', () => {
  const e = mk({
    skill_id: 'vocabulary.b1',
    question: 'Chọn từ đồng nghĩa với "enormous".',
    explanation: 'Từ vựng chưa biết: enormous = rất lớn.',
  });
  assert.equal(classifyError(e), 'vocab');
});

test('classifyError: explanation có "bẫy distract" → trap', () => {
  const e = mk({
    skill_id: 'reading.detail_mcq',
    question: 'Đoạn văn nói gì về hội trường?',
    explanation:
      'Đáp án B là bẫy distract — thông tin có trong bài nhưng không trả lời câu hỏi.',
  });
  assert.equal(classifyError(e), 'trap');
});

test('classifyError: question có "Nghe" + skill listening → listen_detail', () => {
  const e = mk({
    skill_id: 'listening.short_convo',
    question: 'Nghe hội thoại và chọn đáp án đúng.',
    explanation: 'Sót chi tiết: bạn nghe nhầm giờ gặp.',
  });
  assert.equal(classifyError(e), 'listen_detail');
});

test('classifyError: không khớp keyword nào → other (fallback)', () => {
  const e = mk({
    question: 'Câu A.',
    explanation: 'Lý do chung chung.',
  });
  assert.equal(classifyError(e), 'other');
});

// ---------- aggregateErrors ----------

test('aggregateErrors: 6 entry → byTag + topTags đúng thứ tự + pct', () => {
  const entries: MistakeEntry[] = [
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì đúng.', explanation: 'Sai ngữ pháp.' }),
    mk({ skill_id: 'grammar.b1', question: 'Điền giới từ.', explanation: 'Sai giới từ.' }),
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì quá khứ.', explanation: 'Sai thì.' }),
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Đoạn nói gì?',
      explanation: 'Bẫy distract.',
    }),
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Ai là người?',
      explanation: 'Dính bẫy.',
    }),
    mk({
      skill_id: 'listening.short_convo',
      question: 'Nghe hội thoại.',
      explanation: 'Sót chi tiết.',
    }),
  ];
  const agg = aggregateErrors(entries);

  assert.equal(agg.total, 6);
  // byTag: grammar 3, trap 2, listen_detail 1, còn lại 0.
  assert.equal(agg.byTag.grammar, 3);
  assert.equal(agg.byTag.trap, 2);
  assert.equal(agg.byTag.listen_detail, 1);
  assert.equal(agg.byTag.vocab, 0);
  assert.equal(agg.byTag.other, 0);

  // topTags giảm dần: grammar(3,50%) → trap(2,33%) → listen_detail(1,17%).
  assert.equal(agg.topTags.length, 3);
  assert.deepEqual(agg.topTags[0], { tag: 'grammar', count: 3, pct: 50 });
  assert.deepEqual(agg.topTags[1], { tag: 'trap', count: 2, pct: 33 });
  assert.deepEqual(agg.topTags[2], { tag: 'listen_detail', count: 1, pct: 17 });
});

test('aggregateErrors: empty array → total 0, topTags [], byTag toàn 0', () => {
  const agg = aggregateErrors([]);
  assert.equal(agg.total, 0);
  assert.equal(agg.topTags.length, 0);
  for (const t of ERROR_TAGS) {
    assert.equal(agg.byTag[t], 0);
  }
});

// ---------- weakSubjects ----------

test('weakSubjects: trap + reading_detail nhiều → subject reading', () => {
  const entries: MistakeEntry[] = [
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Đoạn nói gì?',
      explanation: 'Bẫy distract.',
    }),
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Ai làm việc này?',
      explanation: 'Dính bẫy.',
    }),
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Chi tiết nào đúng?',
      explanation: 'Đọc sót chi tiết.',
    }),
    mk({
      skill_id: 'reading.detail_mcq',
      question: 'Chi tiết nào đúng nữa?',
      explanation: 'Sót chi tiết.',
    }),
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì.', explanation: 'Sai ngữ pháp.' }),
  ];
  const sug = weakSubjects(entries);
  assert.ok(sug, 'phải trả gợi ý (không null)');
  assert.equal(sug.subject, 'reading');
  assert.ok(sug.reason.includes('Reading'), 'reason nhắc Reading');
});

test('weakSubjects: listen_detail nhiều → subject listening', () => {
  const entries: MistakeEntry[] = [
    mk({
      skill_id: 'listening.short_convo',
      question: 'Nghe hội thoại.',
      explanation: 'Sót chi tiết.',
    }),
    mk({
      skill_id: 'listening.long_convo',
      question: 'Nghe đoạn dài.',
      explanation: 'Nghe nhầm.',
    }),
    mk({
      skill_id: 'listening.gap_fill',
      question: 'Nghe điền form.',
      explanation: 'Sót.',
    }),
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì.', explanation: 'Sai ngữ pháp.' }),
  ];
  const sug = weakSubjects(entries);
  assert.ok(sug, 'phải trả gợi ý (không null)');
  assert.equal(sug.subject, 'listening');
  assert.ok(sug.reason.includes('Listening'), 'reason nhắc Listening');
});

test('weakSubjects: grammar + vocab chiếm đa số → subject foundation', () => {
  const entries: MistakeEntry[] = [
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì.', explanation: 'Sai ngữ pháp.' }),
    mk({ skill_id: 'grammar.b1', question: 'Giới từ.', explanation: 'Sai giới từ.' }),
    mk({
      skill_id: 'vocabulary.b1',
      question: 'Từ đồng nghĩa.',
      explanation: 'Từ vựng chưa biết.',
    }),
  ];
  const sug = weakSubjects(entries);
  assert.ok(sug, 'phải trả gợi ý (không null)');
  assert.equal(sug.subject, 'foundation');
  assert.ok(sug.reason.includes('nền tảng'), 'reason nhắc nền tảng');
});

test('weakSubjects: empty array → null', () => {
  assert.equal(weakSubjects([]), null);
});

test('weakSubjects: mọi câu đều other → null (không đủ tín hiệu)', () => {
  const entries: MistakeEntry[] = [
    mk({ question: 'Câu A.', explanation: 'Lý do chung chung.' }),
    mk({ question: 'Câu B.', explanation: 'Lý do chung chung.' }),
  ];
  assert.equal(weakSubjects(entries), null);
});

test('weakSubjects: nhận summary tái sử dụng — không tính lại', () => {
  const entries: MistakeEntry[] = [
    mk({ skill_id: 'grammar.a2', question: 'Chọn thì.', explanation: 'Sai ngữ pháp.' }),
    mk({ skill_id: 'grammar.b1', question: 'Giới từ.', explanation: 'Sai giới từ.' }),
    mk({
      skill_id: 'vocabulary.b1',
      question: 'Từ đồng nghĩa.',
      explanation: 'Từ vựng chưa biết.',
    }),
  ];
  const agg = aggregateErrors(entries);
  // Truyền summary có sẵn — kết quả phải khớp với weakSubjects(entries).
  const sug = weakSubjects(entries, agg);
  assert.ok(sug);
  assert.equal(sug.subject, 'foundation');
});
