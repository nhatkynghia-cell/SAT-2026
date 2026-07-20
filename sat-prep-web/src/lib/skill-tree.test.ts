import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkillTree, applyTierGate, FREE_DOMAINS, DOMAIN_UNLOCK_THRESHOLD, DOMAIN_PREREQS } from './skill-tree.ts';
import type { MasterySummary } from './mastery.ts';
import type { Subject } from './skill-taxonomy.ts';

// Map chương cho các skill dùng trong test (khớp taxonomy Cambridge thật).
const DOMAIN: Record<string, { domainId: string; domainLabel: string; subject: Subject; moduleType: string }> = {
  'reading.notice_mcq': { domainId: 'reading', domainLabel: 'Reading', subject: 'reading', moduleType: 'reading' },
  'reading.matching': { domainId: 'reading', domainLabel: 'Reading', subject: 'reading', moduleType: 'reading' },
  'grammar.a2': { domainId: 'grammar', domainLabel: 'Grammar', subject: 'foundation', moduleType: 'grammar' },
  'grammar.b1': { domainId: 'grammar', domainLabel: 'Grammar', subject: 'foundation', moduleType: 'grammar' },
  'vocabulary.a2': { domainId: 'vocabulary', domainLabel: 'Vocabulary', subject: 'foundation', moduleType: 'vocabulary' },
  'writing.short_message': { domainId: 'writing', domainLabel: 'Writing', subject: 'writing', moduleType: 'writing' },
  'speaking.interview': { domainId: 'speaking', domainLabel: 'Speaking', subject: 'speaking', moduleType: 'speaking' },
};

function fakeSummary(
  entries: Record<string, { score: number; attempts: number; mastered?: boolean }>
): MasterySummary {
  const skills = Object.entries(entries).map(([id, v]) => ({
    id,
    label: id,
    correct: 0,
    score: v.score,
    attempts: v.attempts,
    reliable: v.attempts >= 5,
    mastered: v.mastered ?? false,
    ...DOMAIN[id],
  }));
  return { skills, bySubject: {}, overall: 0 } as unknown as MasterySummary;
}

test('node reading: chưa luyện → available (chương tiếp nhận không có tiên quyết)', () => {
  const view = buildSkillTree(fakeSummary({ 'reading.notice_mcq': { score: 0, attempts: 0 } }));
  const n = view.nodes.find((x) => x.id === 'reading.notice_mcq');
  assert.equal(n?.state, 'available');
});

test('node đã làm nhưng chưa thạo → in_progress', () => {
  const view = buildSkillTree(fakeSummary({ 'reading.notice_mcq': { score: 50, attempts: 6 } }));
  assert.equal(view.nodes.find((x) => x.id === 'reading.notice_mcq')?.state, 'in_progress');
});

test('node mastered → mastered + đếm vào masteredCount', () => {
  const view = buildSkillTree(fakeSummary({ 'reading.notice_mcq': { score: 90, attempts: 8, mastered: true } }));
  assert.equal(view.nodes.find((x) => x.id === 'reading.notice_mcq')?.state, 'mastered');
  assert.equal(view.masteredCount, 1);
});

test('writing bị KHÓA khi grammar chưa đạt ngưỡng', () => {
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: 10, attempts: 5 },
    'writing.short_message': { score: 0, attempts: 0 },
  }));
  const w = view.nodes.find((x) => x.id === 'writing.short_message');
  assert.equal(w?.state, 'locked');
  assert.ok(w?.lockedBy && w.lockedBy.length > 0, 'phải nêu chương tiên quyết');
});

test('writing MỞ KHÓA khi grammar đạt ngưỡng VÀ gate passed', () => {
  const gates = { grammar: { passed: true, lastAttempt: '2026-01-01', score: 5, correctSinceFail: 0 } };
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: DOMAIN_UNLOCK_THRESHOLD + 10, attempts: 6 },
    'writing.short_message': { score: 0, attempts: 0 },
  }), gates);
  assert.equal(view.nodes.find((x) => x.id === 'writing.short_message')?.state, 'available');
});

test('writing VẪN KHÓA khi grammar đạt ngưỡng nhưng gate chưa pass', () => {
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: DOMAIN_UNLOCK_THRESHOLD + 10, attempts: 6 },
    'writing.short_message': { score: 0, attempts: 0 },
  }));
  assert.equal(view.nodes.find((x) => x.id === 'writing.short_message')?.state, 'locked');
});

test('gate ĐÃ PASS thì writing KHÔNG bị re-lock khi grammar mastery tụt dưới ngưỡng', () => {
  // Kịch bản decay: học sinh qua cổng grammar (gate passed vĩnh viễn) rồi chuyển
  // sang luyện writing, ngừng ôn grammar → EWMA grammar tụt < ngưỡng.
  // Qua cổng LÀ bằng chứng bền → writing phải GIỮ mở khóa, không tụt tiến trình.
  const gates = { grammar: { passed: true, lastAttempt: '2026-01-01', score: 5, correctSinceFail: 0 } };
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: 10, attempts: 8 }, // đã decay < DOMAIN_UNLOCK_THRESHOLD
    'writing.short_message': { score: 30, attempts: 6 },
  }), gates);
  const grammar = view.domains.find((d) => d.id === 'grammar');
  assert.ok(grammar && grammar.avgScore < DOMAIN_UNLOCK_THRESHOLD, 'tiền đề: grammar đã tụt dưới ngưỡng');
  assert.equal(grammar?.satisfied, true, 'gate passed → satisfied giữ true dù mastery tụt');
  assert.notEqual(
    view.nodes.find((x) => x.id === 'writing.short_message')?.state,
    'locked',
    'writing KHÔNG được re-lock khi gate grammar đã pass'
  );
});

test('avg chương tính trên TẤT CẢ skill của chương (kể cả skill chưa làm = 0)', () => {
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: 80, attempts: 6 },
    'grammar.b1': { score: 0, attempts: 0 },
  }));
  const dom = view.domains.find((d) => d.id === 'grammar');
  assert.equal(dom?.avgScore, 40);
});

test('Reading độc lập — không bị khóa bởi grammar', () => {
  const view = buildSkillTree(fakeSummary({
    'grammar.a2': { score: 0, attempts: 0 },
    'reading.notice_mcq': { score: 0, attempts: 0 },
  }));
  assert.equal(view.nodes.find((x) => x.id === 'reading.notice_mcq')?.state, 'available');
});

test('DOMAIN_PREREQS: writing←grammar, speaking←grammar+vocabulary; tiếp nhận & nền tảng không cần', () => {
  assert.deepEqual(DOMAIN_PREREQS.writing, ['grammar']);
  assert.deepEqual([...DOMAIN_PREREQS.speaking].sort(), ['grammar', 'vocabulary']);
  assert.deepEqual(DOMAIN_PREREQS.reading, []);
  assert.deepEqual(DOMAIN_PREREQS.listening, []);
  assert.deepEqual(DOMAIN_PREREQS.grammar, []);
  assert.deepEqual(DOMAIN_PREREQS.vocabulary, []);
});

// ── applyTierGate (phân tầng theo gói) ──

test('FREE_DOMAINS = reading + grammar (nếm kỹ năng tiếp nhận + nền tảng)', () => {
  assert.deepEqual([...FREE_DOMAINS].sort(), ['grammar', 'reading']);
});

test('applyTierGate premium → no-op (trả nguyên view, không khóa gì)', () => {
  const view = buildSkillTree(fakeSummary({
    'reading.notice_mcq': { score: 80, attempts: 6 },
    'grammar.a2': { score: 70, attempts: 6, mastered: true },
  }));
  const gated = applyTierGate(view, 'premium');
  assert.equal(gated, view, 'premium phải nhận đúng object gốc (no-op)');
});

test('applyTierGate ultimate → no-op', () => {
  const view = buildSkillTree(fakeSummary({ 'reading.notice_mcq': { score: 80, attempts: 6 } }));
  assert.equal(applyTierGate(view, 'ultimate'), view);
});

test('applyTierGate free → chương ngoài free bị tierLocked, chương free giữ nguyên', () => {
  const view = buildSkillTree(fakeSummary({
    'reading.notice_mcq': { score: DOMAIN_UNLOCK_THRESHOLD + 10, attempts: 6 },
    'vocabulary.a2': { score: 50, attempts: 6 },
    'grammar.a2': { score: 30, attempts: 6 },
  }));
  const gated = applyTierGate(view, 'free');
  const reading = gated.domains.find((d) => d.id === 'reading');
  const vocab = gated.domains.find((d) => d.id === 'vocabulary');
  const grammar = gated.domains.find((d) => d.id === 'grammar');
  assert.ok(!reading?.tierLocked, 'reading là free → không khóa');
  assert.ok(!grammar?.tierLocked, 'grammar là free → không khóa');
  assert.equal(vocab?.tierLocked, true, 'vocabulary ngoài free → tierLocked');
});

test('applyTierGate free → node chương trả phí bị ép locked + score ẩn (0)', () => {
  const view = buildSkillTree(fakeSummary({
    'reading.notice_mcq': { score: 60, attempts: 6 },
    'vocabulary.a2': { score: 55, attempts: 6, mastered: true },
  }));
  const gated = applyTierGate(view, 'free');
  const vNode = gated.nodes.find((n) => n.id === 'vocabulary.a2');
  assert.equal(vNode?.state, 'locked');
  assert.equal(vNode?.tierLocked, true);
  assert.equal(vNode?.score, 0, 'không lộ điểm chương trả phí');
});

test('applyTierGate free → masteredCount chỉ đếm node free, totalNodes giữ nguyên', () => {
  const view = buildSkillTree(fakeSummary({
    'reading.notice_mcq': { score: 90, attempts: 8, mastered: true }, // free, mastered
    'vocabulary.a2': { score: 90, attempts: 8, mastered: true },      // trả phí, mastered
  }));
  assert.equal(view.masteredCount, 2, 'trước gate: cả 2 mastered');
  const gated = applyTierGate(view, 'free');
  assert.equal(gated.masteredCount, 1, 'sau gate: chỉ đếm node free');
  assert.equal(gated.totalNodes, view.totalNodes, 'totalNodes ổn định');
});
