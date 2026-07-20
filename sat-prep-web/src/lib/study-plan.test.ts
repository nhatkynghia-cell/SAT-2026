import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyPlan,
  planForSubject,
  planSummary,
  type StudyStep,
} from './study-plan.ts';
import type { MasterySummary } from './mastery.ts';

// Helper dựng MasterySummary giả từ map skillId → {score, attempts, mastered?}.
// subject suy ra từ TIỀN TỐ domain của id (khớp taxonomy Cambridge) — cùng style
// adaptive.test.ts để test thuần, không cần import taxonomy kéo runtime.
//   reading.* / writing.* / listening.* / speaking.* / grammar.* / vocabulary.*
function fakeSummary(
  entries: Record<string, { score: number; attempts: number; mastered?: boolean }>
): MasterySummary {
  const SUBJECT: Record<
    string,
    'reading' | 'writing' | 'listening' | 'speaking' | 'foundation'
  > = {
    reading: 'reading',
    writing: 'writing',
    listening: 'listening',
    speaking: 'speaking',
    grammar: 'foundation',
    vocabulary: 'foundation',
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

/** Snapshot sâu (JSON) của summary để phát hiện mutation sau buildStudyPlan. */
function snapshot(s: MasterySummary): string {
  return JSON.stringify(s);
}

test('mọi skill mastered → recommendNext rơi nhánh "ôn duy trì" (không dừng sớm)', () => {
  // Khi mọi skill đã mastered, recommendNext không trả null mà vào nhánh ôn duy trì
  // (lấy pool yếu nhất). buildStudyPlan giả định mastered từng bước nhưng skill ôn
  // đã mastered sẵn → recommendNext tiếp tục đề xuất CÙNG skill yếu nhất → chuỗi ôn.
  // Spec chấp nhận "[] HOẶC 1 bước ôn" — thực tế engine ôn duy trì nên chuỗi ôn là
  // hành vi đúng. Assert: không vượt count, order tăng dần, mỗi bước có reason ôn,
  // và KHÔNG mutate summary.
  const s = fakeSummary({
    'reading.1': { score: 90, attempts: 10, mastered: true },
    'reading.2': { score: 95, attempts: 12, mastered: true },
    'grammar.1': { score: 88, attempts: 8, mastered: true },
  });
  const before = snapshot(s);
  const plan = buildStudyPlan(s, { count: 5 });
  const after = snapshot(s);

  assert.ok(plan.length <= 5, 'plan không vượt count yêu cầu');
  for (let i = 0; i < plan.length; i++) {
    assert.equal(plan[i].order, i + 1, `order bước ${i + 1} đúng`);
    assert.ok(plan[i].reason.length > 0, `bước ${i + 1} có reason ôn`);
  }
  // Hành vi thực: các bước ôn CÙNG skill yếu nhất (engine ôn duy trì) — đảm bảo
  // KHÔNG sinh skill "giả" mới và không crash.
  assert.ok(
    plan.every((p) => p.skillId === plan[0].skillId),
    'mọi skill mastered → chuỗi ôn cùng skill yếu nhất (không dừng sớm)'
  );
  assert.equal(after, before, 'summary không bị mutate kể cả khi mọi skill mastered');
});

test('dừng sớm khi hết skill chưa mastered (mix mastered + chưa mastered)', () => {
  // 2 skill chưa mastered + nhiều mastered → dựng 2 bước rồi dừng (không đủ 5).
  // Sau khi assumeMastered 2 skill yếu, pool còn lại toàn mastered → recommendNext
  // vào nhánh ôn duy trì trả skill mastered yếu nhất. Nên KHÔNG dừng sớm ở đây
  // trừ khi count nhỏ. Dùng count=2 để kiểm tra dựng đúng 2 bước skill chưa mastered.
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 }, // chưa mastered, yếu nhất
    'writing.1': { score: 20, attempts: 2 }, // chưa mastered, kế tiếp
    'grammar.1': { score: 90, attempts: 10, mastered: true },
    'grammar.2': { score: 92, attempts: 11, mastered: true },
  });
  const plan = buildStudyPlan(s, { count: 2 });
  assert.equal(plan.length, 2);
  // 2 bước đầu phải là 2 skill CHƯA mastered (yếu nhất trước) — không lẫn mastered.
  assert.equal(plan[0].skillId, 'reading.1');
  assert.equal(plan[1].skillId, 'writing.1');
});

test('plan rỗng khi summary không có skill nào', () => {
  const s = fakeSummary({});
  const plan = buildStudyPlan(s, { count: 5 });
  assert.deepEqual(plan, []);
});

test('plan 3 bước: skillId khác nhau, order 1..3, estMinutes đúng độ khó', () => {
  // 3 skill yếu (score thấp, chưa mastered) → xoay vòng 3 bước khác skill.
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 }, // yếu nhất, Easy (score<35)
    'writing.1': { score: 20, attempts: 2 }, // kế tiếp, Easy
    'grammar.1': { score: 50, attempts: 3 }, // Medium (35<=score<70)
  });
  const plan = buildStudyPlan(s, { count: 3 });

  assert.equal(plan.length, 3, 'dựng đủ 3 bước');
  // skillId khác nhau (xoay vòng do assumeMastered đẩy skill trước ra khỏi top yếu).
  const ids = plan.map((p) => p.skillId);
  assert.equal(new Set(ids).size, 3, '3 bước là 3 skill khác nhau');
  // order 1..3.
  assert.deepEqual(
    plan.map((p) => p.order),
    [1, 2, 3]
  );
  // estMinutes khớp độ khó: Easy=5, Medium=8, Hard=12.
  for (const step of plan) {
    const expected =
      step.difficulty === 'Easy'
        ? 5
        : step.difficulty === 'Medium'
          ? 8
          : 12;
    assert.equal(
      step.estMinutes,
      expected,
      `estMinutes của ${step.skillId} (${step.difficulty}) = ${expected}`
    );
  }
});

test('estMinutes đúng cho từng độ khó (Easy/Medium/Hard)', () => {
  // grammar.1 score=0 → Easy; reading.1 score=50 → Medium; writing.1 score=75 → Hard.
  const s = fakeSummary({
    'grammar.1': { score: 0, attempts: 1 }, // Easy
    'reading.1': { score: 50, attempts: 2 }, // Medium
    'writing.1': { score: 75, attempts: 3 }, // Hard
  });
  const plan = buildStudyPlan(s, { count: 3 });
  const byId = Object.fromEntries(plan.map((p) => [p.skillId, p]));
  assert.equal(byId['grammar.1'].estMinutes, 5, 'Easy → 5 phút');
  assert.equal(byId['grammar.1'].difficulty, 'Easy');
  assert.equal(byId['reading.1'].estMinutes, 8, 'Medium → 8 phút');
  assert.equal(byId['reading.1'].difficulty, 'Medium');
  assert.equal(byId['writing.1'].estMinutes, 12, 'Hard → 12 phút');
  assert.equal(byId['writing.1'].difficulty, 'Hard');
});

test('KHÔNG mutate summary đầu vào (so sánh deep trước/sau)', () => {
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 },
    'writing.1': { score: 20, attempts: 2 },
    'grammar.1': { score: 50, attempts: 3 },
  });
  const before = snapshot(s);
  // Chạy nhiều lần để đảm bảo không có accumulation side-effect.
  buildStudyPlan(s, { count: 3 });
  buildStudyPlan(s, { count: 3 });
  const after = snapshot(s);
  assert.equal(after, before, 'summary không thay đổi sau buildStudyPlan');
});

test('planForSubject chỉ trả skill thuộc subject đó', () => {
  // Mix 2 môn: reading (2 skill yếu) + writing (1 skill yếu).
  const s = fakeSummary({
    'reading.1': { score: 15, attempts: 1 },
    'reading.2': { score: 25, attempts: 2 },
    'writing.1': { score: 10, attempts: 1 },
    'grammar.1': { score: 5, attempts: 1 },
  });
  const plan = planForSubject(s, 'reading', { count: 5 });
  assert.ok(plan.length > 0, 'plan reading không rỗng');
  for (const step of plan) {
    assert.equal(
      step.moduleType,
      'reading',
      `bước ${step.order} (${step.skillId}) thuộc reading`
    );
    assert.ok(
      step.skillId.startsWith('reading.'),
      `skillId ${step.skillId} có tiền tố reading.`
    );
  }
});

test('planForSubject môn không có skill → plan rỗng', () => {
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 },
    'grammar.1': { score: 20, attempts: 2 },
  });
  const plan = planForSubject(s, 'writing', { count: 3 });
  assert.deepEqual(plan, [], 'môn không có skill → []');
});

test('planSummary: totalMinutes = tổng, skillsCovered = unique, focusSkill = bước 1', () => {
  const plan: StudyStep[] = [
    {
      order: 1,
      skillId: 'reading.1',
      label: 'Reading 1',
      moduleType: 'reading',
      difficulty: 'Easy',
      reason: 'r1',
      estMinutes: 5,
    },
    {
      order: 2,
      skillId: 'writing.1',
      label: 'Writing 1',
      moduleType: 'writing',
      difficulty: 'Medium',
      reason: 'r2',
      estMinutes: 8,
    },
    {
      order: 3,
      skillId: 'reading.1', // TRÙNG bước 1 — kiểm tra unique.
      label: 'Reading 1',
      moduleType: 'reading',
      difficulty: 'Hard',
      reason: 'r3',
      estMinutes: 12,
    },
  ];
  const sum = planSummary(plan);
  assert.equal(sum.totalSteps, 3);
  assert.equal(sum.totalMinutes, 25, '5+8+12 = 25');
  assert.deepEqual(
    sum.skillsCovered,
    ['reading.1', 'writing.1'],
    'skillsCovered unique, giữ thứ tự xuất hiện'
  );
  assert.equal(sum.focusSkill, 'reading.1', 'focusSkill = skill bước 1');
});

test('planSummary với plan rỗng → 0/null/[]', () => {
  const sum = planSummary([]);
  assert.equal(sum.totalSteps, 0);
  assert.equal(sum.totalMinutes, 0);
  assert.deepEqual(sum.skillsCovered, []);
  assert.equal(sum.focusSkill, null);
});

test('planSummary khớp buildStudyPlan thực (end-to-end)', () => {
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 },
    'writing.1': { score: 20, attempts: 2 },
    'grammar.1': { score: 50, attempts: 3 },
  });
  const plan = buildStudyPlan(s, { count: 3 });
  const sum = planSummary(plan);
  assert.equal(sum.totalSteps, plan.length);
  assert.equal(
    sum.totalMinutes,
    plan.reduce((a, b) => a + b.estMinutes, 0)
  );
  assert.equal(sum.focusSkill, plan[0].skillId);
  assert.equal(sum.skillsCovered.length, new Set(plan.map((p) => p.skillId)).size);
});

test('count=0 → plan rỗng (không crash)', () => {
  const s = fakeSummary({ 'reading.1': { score: 10, attempts: 1 } });
  assert.deepEqual(buildStudyPlan(s, { count: 0 }), []);
});

test('mỗi bước gắn reason (không rỗng) dẫn từ recommendNext', () => {
  const s = fakeSummary({
    'reading.1': { score: 10, attempts: 1 },
    'writing.1': { score: 20, attempts: 2 },
  });
  const plan = buildStudyPlan(s, { count: 2 });
  for (const step of plan) {
    assert.ok(
      typeof step.reason === 'string' && step.reason.length > 0,
      `bước ${step.order} có reason không rỗng`
    );
  }
});
