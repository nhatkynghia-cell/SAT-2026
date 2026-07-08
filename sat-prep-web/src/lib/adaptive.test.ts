import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDifficulty, recommendNext, towerDifficulty, pickTowerSkill, TOWER_SKILL_WINDOW, EASY_CEILING, HARD_FLOOR, speedQuizDifficulty, pickSpeedQuizSkill, SPEED_QUIZ_SKILL_WINDOW } from './adaptive.ts';
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

test('pickTowerSkill: summary rỗng / không có math → null', () => {
  assert.equal(pickTowerSkill([], 1), null);
  const onlyReading = fakeSummary({ 'rw.vocab': { score: 10, attempts: 5 } });
  assert.equal(pickTowerSkill(onlyReading.skills, 1), null);
});

test('pickTowerSkill: chỉ chọn skill MATH, bỏ qua reading', () => {
  const s = fakeSummary({
    'rw.vocab': { score: 1, attempts: 5 },          // reading yếu nhất nhưng phải bỏ qua
    'algebra.linear_eq': { score: 40, attempts: 5 },
  });
  const pick = pickTowerSkill(s.skills, 1);
  assert.ok(pick);
  assert.equal(pick.moduleType, 'math');
  assert.equal(pick.skillId, 'algebra.linear_eq');
});

test('pickTowerSkill: ưu tiên skill math YẾU NHẤT (chưa thành thạo)', () => {
  const s = fakeSummary({
    'algebra.linear_eq': { score: 80, attempts: 10 },
    'geo.trig': { score: 15, attempts: 6 },          // yếu nhất
    'data.probability': { score: 50, attempts: 8 },
  });
  const pick = pickTowerSkill(s.skills, 1); // tầng 1 → phần tử đầu của window (yếu nhất)
  assert.equal(pick?.skillId, 'geo.trig');
});

test('pickTowerSkill: XOAY VÒNG chủ đề theo tầng (đỡ nhàm)', () => {
  const s = fakeSummary({
    'geo.trig': { score: 10, attempts: 6 },          // window[0]
    'data.probability': { score: 20, attempts: 6 },  // window[1]
    'algebra.linear_eq': { score: 30, attempts: 6 }, // window[2]
  });
  const f1 = pickTowerSkill(s.skills, 1)?.skillId;
  const f2 = pickTowerSkill(s.skills, 2)?.skillId;
  const f3 = pickTowerSkill(s.skills, 3)?.skillId;
  // 3 tầng liên tiếp → 3 skill KHÁC nhau (xoay vòng), không kẹt 1 chủ đề.
  assert.equal(new Set([f1, f2, f3]).size, 3);
  // Tầng 4 quay lại đầu vòng (3 skill trong window).
  assert.equal(pickTowerSkill(s.skills, 4)?.skillId, f1);
});

test('pickTowerSkill: gắn difficulty khớp towerDifficulty (skill + tầng)', () => {
  const s = fakeSummary({ 'geo.trig': { score: 10, attempts: 6 } });
  const pick = pickTowerSkill(s.skills, 20);
  assert.equal(pick?.difficulty, towerDifficulty(10, 20)); // 'Hard' (Easy nền +2)
});

test('pickTowerSkill: window giới hạn TOWER_SKILL_WINDOW skill yếu nhất', () => {
  // 6 skill math, window=5 → skill MẠNH nhất (score cao nhất) không nằm trong vòng xoay.
  const s = fakeSummary({
    'algebra.linear_eq': { score: 5, attempts: 6 },
    'algebra.systems': { score: 10, attempts: 6 },
    'geo.trig': { score: 15, attempts: 6 },
    'geo.circles': { score: 20, attempts: 6 },
    'data.ratios': { score: 25, attempts: 6 },
    'data.probability': { score: 99, attempts: 6 }, // mạnh nhất — ngoài window
  });
  const seen = new Set<string>();
  for (let floor = 1; floor <= 10; floor++) {
    const id = pickTowerSkill(s.skills, floor)?.skillId;
    if (id) seen.add(id);
  }
  assert.equal(seen.size, TOWER_SKILL_WINDOW);
  assert.ok(!seen.has('data.probability'), 'skill mạnh nhất không được vào vòng xoay');
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

test('pickSpeedQuizSkill: ĐA MÔN — chọn skill yếu nhất bất kể môn (khác Tower chỉ Toán)', () => {
  const s = fakeSummary({
    'rw.vocab': { score: 5, attempts: 5 },           // reading, yếu nhất
    'algebra.linear_eq': { score: 40, attempts: 5 }, // math
  });
  const pick = pickSpeedQuizSkill(s.skills, 0); // câu đầu → phần tử đầu window (yếu nhất)
  assert.ok(pick);
  assert.equal(pick.skillId, 'rw.vocab'); // Speed Quiz KHÔNG bỏ qua reading như Tower
});

test('pickSpeedQuizSkill: XOAY VÒNG chủ đề theo số câu đúng', () => {
  const s = fakeSummary({
    'rw.vocab': { score: 10, attempts: 6 },          // window[0]
    'data.probability': { score: 20, attempts: 6 },  // window[1]
    'algebra.linear_eq': { score: 30, attempts: 6 }, // window[2]
  });
  const a0 = pickSpeedQuizSkill(s.skills, 0)?.skillId;
  const a1 = pickSpeedQuizSkill(s.skills, 1)?.skillId;
  const a2 = pickSpeedQuizSkill(s.skills, 2)?.skillId;
  assert.equal(new Set([a0, a1, a2]).size, 3);
  // Câu thứ 4 (answered=3) quay lại đầu vòng.
  assert.equal(pickSpeedQuizSkill(s.skills, 3)?.skillId, a0);
});

test('pickSpeedQuizSkill: gắn difficulty khớp speedQuizDifficulty', () => {
  const s = fakeSummary({ 'geo.trig': { score: 10, attempts: 6 } });
  const pick = pickSpeedQuizSkill(s.skills, 10);
  assert.equal(pick?.difficulty, speedQuizDifficulty(10, 10)); // 'Hard' (Easy nền +2)
});

test('pickSpeedQuizSkill: window giới hạn SPEED_QUIZ_SKILL_WINDOW skill yếu nhất', () => {
  const entries: Record<string, { score: number; attempts: number }> = {};
  for (let i = 0; i < 10; i++) entries[`skill.${i}`] = { score: i * 5, attempts: 6 };
  entries['strong.one'] = { score: 99, attempts: 6 }; // mạnh nhất — ngoài window
  const s = fakeSummary(entries);
  const seen = new Set<string>();
  for (let a = 0; a < 12; a++) {
    const id = pickSpeedQuizSkill(s.skills, a)?.skillId;
    if (id) seen.add(id);
  }
  assert.equal(seen.size, SPEED_QUIZ_SKILL_WINDOW);
  assert.ok(!seen.has('strong.one'), 'skill mạnh nhất không được vào vòng xoay');
});
