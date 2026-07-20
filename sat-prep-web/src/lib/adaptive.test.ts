import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDifficulty, recommendNext, towerDifficulty, pickTowerSkill, TOWER_SKILL_WINDOW, EASY_CEILING, HARD_FLOOR, speedQuizDifficulty, pickSpeedQuizSkill, SPEED_QUIZ_SKILL_WINDOW } from './adaptive.ts';
import type { MasterySummary } from './mastery.ts';

// Helper dựng MasterySummary giả từ map skillId → {score, attempts, ...}.
// Suy ra subject/moduleType từ TIỀN TỐ domain của id (khớp taxonomy Cambridge):
//   reading.* / writing.* / listening.* / speaking.* / grammar.* / vocabulary.*
function fakeSummary(
  entries: Record<string, { score: number; attempts: number; mastered?: boolean }>
): MasterySummary {
  const SUBJECT: Record<string, 'reading' | 'writing' | 'listening' | 'speaking' | 'foundation'> = {
    reading: 'reading', writing: 'writing', listening: 'listening', speaking: 'speaking',
    grammar: 'foundation', vocabulary: 'foundation',
  };
  const skills = Object.entries(entries).map(([id, v]) => {
    const domain = id.split('.')[0];
    return {
      id,
      label: id,
      correct: 0,
      score: v.score,
      attempts: v.attempts,
      reliable: v.attempts >= 5,
      mastered: v.mastered ?? false,
      subject: SUBJECT[domain] ?? 'foundation',
      moduleType: domain,
    };
  });
  return { skills, bySubject: {}, overall: 0 } as unknown as MasterySummary;
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
    'reading.notice_mcq': { score: 80, attempts: 10 },
    'grammar.b1': { score: 20, attempts: 6 },       // yếu nhất
    'vocabulary.a2': { score: 50, attempts: 8 },
  });
  const rec = recommendNext(s);
  assert.ok(rec);
  assert.equal(rec.skillId, 'grammar.b1');
  assert.equal(rec.difficulty, 'Easy'); // score 20 < EASY_CEILING
});

test('recommendNext: ưu tiên skill CHƯA luyện (attempts=0) khi cùng score thấp', () => {
  const s = fakeSummary({
    'reading.notice_mcq': { score: 0, attempts: 3 },
    'reading.matching': { score: 0, attempts: 0 },   // cùng score 0, ít attempts hơn
  });
  const rec = recommendNext(s);
  assert.equal(rec?.skillId, 'reading.matching');
});

test('recommendNext: lọc theo subject reading', () => {
  const s = fakeSummary({
    'grammar.a2': { score: 10, attempts: 5 },        // foundation, yếu hơn
    'reading.notice_mcq': { score: 60, attempts: 5 },// reading
  });
  const rec = recommendNext(s, { subject: 'reading' });
  assert.ok(rec);
  assert.equal(rec.skillId, 'reading.notice_mcq');
});

test('recommendNext: đã thành thạo HẾT → vẫn trả 1 skill để ôn duy trì', () => {
  const s = fakeSummary({
    'reading.notice_mcq': { score: 90, attempts: 10, mastered: true },
    'grammar.b1': { score: 85, attempts: 10, mastered: true },
  });
  const rec = recommendNext(s);
  assert.ok(rec, 'phải trả về 1 skill ôn tập, không null');
  assert.match(rec.reason, /thành thạo|duy trì/i);
});

test('recommendNext: bộ lọc moduleType không khớp gì → null', () => {
  const s = fakeSummary({ 'reading.notice_mcq': { score: 10, attempts: 5 } });
  const rec = recommendNext(s, { moduleType: 'nonexistent' });
  assert.equal(rec, null);
});

// ─── THÁP VÔ TẬN (Tower) ──────────────────────────────────────────────────

test('towerDifficulty: tầng thấp giữ NỀN theo mastery (không cộng áp lực)', () => {
  // floor <= 8 → +0: bằng selectDifficulty thuần.
  assert.equal(towerDifficulty(10, 1), 'Easy');   // mastery thấp
  assert.equal(towerDifficulty(50, 5), 'Medium'); // mastery trung bình
  assert.equal(towerDifficulty(90, 8), 'Hard');   // mastery cao
});

test('towerDifficulty: áp lực tầng đẩy độ khó lên (cùng mastery)', () => {
  // mastery yếu (Easy nền) nhưng leo cao → khó dần.
  assert.equal(towerDifficulty(10, 8), 'Easy');    // +0
  assert.equal(towerDifficulty(10, 12), 'Medium'); // +1
  assert.equal(towerDifficulty(10, 20), 'Hard');   // +2
});

test('towerDifficulty: KẸP trần ở Hard (không vượt)', () => {
  // mastery cao (Hard nền) + áp lực tầng vẫn chỉ Hard, không lỗi/ngoài thang.
  assert.equal(towerDifficulty(95, 30), 'Hard');
  assert.equal(towerDifficulty(50, 30), 'Hard'); // Medium nền +2 → cap Hard
});

test('pickTowerSkill: summary rỗng / không có reading → null', () => {
  assert.equal(pickTowerSkill([], 1), null);
  const onlyGrammar = fakeSummary({ 'grammar.a2': { score: 10, attempts: 5 } });
  assert.equal(pickTowerSkill(onlyGrammar.skills, 1), null);
});

test('pickTowerSkill: chỉ chọn skill READING, bỏ qua kỹ năng khác', () => {
  const s = fakeSummary({
    'grammar.a2': { score: 1, attempts: 5 },          // yếu nhất nhưng phải bỏ qua
    'reading.notice_mcq': { score: 40, attempts: 5 },
  });
  const pick = pickTowerSkill(s.skills, 1);
  assert.ok(pick);
  assert.equal(pick.moduleType, 'reading');
  assert.equal(pick.skillId, 'reading.notice_mcq');
});

test('pickTowerSkill: ưu tiên skill reading YẾU NHẤT (chưa thành thạo)', () => {
  const s = fakeSummary({
    'reading.notice_mcq': { score: 80, attempts: 10 },
    'reading.open_cloze': { score: 15, attempts: 6 },  // yếu nhất
    'reading.detail_mcq': { score: 50, attempts: 8 },
  });
  const pick = pickTowerSkill(s.skills, 1);
  assert.equal(pick?.skillId, 'reading.open_cloze');
});

test('pickTowerSkill: XOAY VÒNG chủ đề theo tầng (đỡ nhàm)', () => {
  const s = fakeSummary({
    'reading.open_cloze': { score: 10, attempts: 6 },  // window[0]
    'reading.matching': { score: 20, attempts: 6 },    // window[1]
    'reading.notice_mcq': { score: 30, attempts: 6 },  // window[2]
  });
  const f1 = pickTowerSkill(s.skills, 1)?.skillId;
  const f2 = pickTowerSkill(s.skills, 2)?.skillId;
  const f3 = pickTowerSkill(s.skills, 3)?.skillId;
  assert.equal(new Set([f1, f2, f3]).size, 3);
  assert.equal(pickTowerSkill(s.skills, 4)?.skillId, f1);
});

test('pickTowerSkill: gắn difficulty khớp towerDifficulty (skill + tầng)', () => {
  const s = fakeSummary({ 'reading.open_cloze': { score: 10, attempts: 6 } });
  const pick = pickTowerSkill(s.skills, 20);
  assert.equal(pick?.difficulty, towerDifficulty(10, 20)); // 'Hard' (Easy nền +2)
});

test('pickTowerSkill: window giới hạn TOWER_SKILL_WINDOW skill yếu nhất', () => {
  // 6 skill reading, window=5 → skill MẠNH nhất không nằm trong vòng xoay.
  const s = fakeSummary({
    'reading.notice_mcq': { score: 5, attempts: 6 },
    'reading.matching': { score: 10, attempts: 6 },
    'reading.detail_mcq': { score: 15, attempts: 6 },
    'reading.gapped_text': { score: 20, attempts: 6 },
    'reading.cloze_vocab': { score: 25, attempts: 6 },
    'reading.open_cloze': { score: 99, attempts: 6 }, // mạnh nhất — ngoài window
  });
  const seen = new Set<string>();
  for (let floor = 1; floor <= 10; floor++) {
    const id = pickTowerSkill(s.skills, floor)?.skillId;
    if (id) seen.add(id);
  }
  assert.equal(seen.size, TOWER_SKILL_WINDOW);
  assert.ok(!seen.has('reading.open_cloze'), 'skill mạnh nhất không được vào vòng xoay');
});

// ─── TRẢ LỜI NHANH (Speed Quiz) ────────────────────────────────────────────

test('speedQuizDifficulty: ít câu đúng giữ NỀN theo mastery (không cộng áp lực)', () => {
  // answered < 5 → +0: bằng selectDifficulty thuần.
  assert.equal(speedQuizDifficulty(10, 0), 'Easy');
  assert.equal(speedQuizDifficulty(50, 4), 'Medium');
  assert.equal(speedQuizDifficulty(90, 0), 'Hard');
});

test('speedQuizDifficulty: đúng nhiều đẩy độ khó lên (cùng mastery)', () => {
  assert.equal(speedQuizDifficulty(10, 4), 'Easy');    // +0
  assert.equal(speedQuizDifficulty(10, 5), 'Medium');  // +1
  assert.equal(speedQuizDifficulty(10, 10), 'Hard');   // +2
});

test('speedQuizDifficulty: KẸP trần ở Hard (không vượt)', () => {
  assert.equal(speedQuizDifficulty(95, 20), 'Hard');
  assert.equal(speedQuizDifficulty(50, 20), 'Hard'); // Medium nền +2 → cap Hard
});

test('pickSpeedQuizSkill: summary rỗng → null', () => {
  assert.equal(pickSpeedQuizSkill([], 0), null);
});

test('pickSpeedQuizSkill: ĐA MÔN — chọn skill yếu nhất bất kể kỹ năng (khác Tower chỉ Reading)', () => {
  const s = fakeSummary({
    'grammar.a2': { score: 5, attempts: 5 },            // foundation, yếu nhất
    'reading.notice_mcq': { score: 40, attempts: 5 },   // reading
  });
  const pick = pickSpeedQuizSkill(s.skills, 0);
  assert.ok(pick);
  assert.equal(pick.skillId, 'grammar.a2'); // Speed Quiz KHÔNG bỏ qua kỹ năng khác như Tower
});

test('pickSpeedQuizSkill: XOAY VÒNG chủ đề theo số câu đúng', () => {
  const s = fakeSummary({
    'vocabulary.a2': { score: 10, attempts: 6 },       // window[0]
    'grammar.b1': { score: 20, attempts: 6 },          // window[1]
    'reading.notice_mcq': { score: 30, attempts: 6 },  // window[2]
  });
  const a0 = pickSpeedQuizSkill(s.skills, 0)?.skillId;
  const a1 = pickSpeedQuizSkill(s.skills, 1)?.skillId;
  const a2 = pickSpeedQuizSkill(s.skills, 2)?.skillId;
  assert.equal(new Set([a0, a1, a2]).size, 3);
  assert.equal(pickSpeedQuizSkill(s.skills, 3)?.skillId, a0);
});

test('pickSpeedQuizSkill: gắn difficulty khớp speedQuizDifficulty', () => {
  const s = fakeSummary({ 'reading.open_cloze': { score: 10, attempts: 6 } });
  const pick = pickSpeedQuizSkill(s.skills, 10);
  assert.equal(pick?.difficulty, speedQuizDifficulty(10, 10)); // 'Hard' (Easy nền +2)
});

test('pickSpeedQuizSkill: window giới hạn SPEED_QUIZ_SKILL_WINDOW skill yếu nhất', () => {
  const entries: Record<string, { score: number; attempts: number }> = {};
  for (let i = 0; i < 10; i++) entries[`reading.s${i}`] = { score: i * 5, attempts: 6 };
  entries['reading.strong'] = { score: 99, attempts: 6 }; // mạnh nhất — ngoài window
  const s = fakeSummary(entries);
  const seen = new Set<string>();
  for (let a = 0; a < 12; a++) {
    const id = pickSpeedQuizSkill(s.skills, a)?.skillId;
    if (id) seen.add(id);
  }
  assert.equal(seen.size, SPEED_QUIZ_SKILL_WINDOW);
  assert.ok(!seen.has('reading.strong'), 'skill mạnh nhất không được vào vòng xoay');
});
