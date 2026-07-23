import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeConfidence,
  hasRetention,
  isDurableMastered,
  countDurableMastered,
  RELIABLE_ATTEMPTS,
  MASTERED_THRESHOLD,
  CONFIDENCE_HALF_LIFE_DAYS,
  type SkillMastery,
} from './mastery.ts';

const NOW_MS = Date.UTC(2026, 6, 15, 12, 0, 0); // 2026-07-15T12:00Z cố định

function skill(patch: Partial<SkillMastery> = {}): SkillMastery {
  return { score: 0, attempts: 0, correct: 0, lastSeen: '', confidence: 0, ...patch };
}

// ── computeConfidence ──────────────────────────────────────────────────────

test('computeConfidence: 0 câu → 0 (chưa có dữ liệu)', () => {
  assert.equal(computeConfidence(0, '', NOW_MS), 0);
  assert.equal(computeConfidence(0, new Date(NOW_MS).toISOString(), NOW_MS), 0);
});

test('computeConfidence: đủ attempts + ôn hôm nay → cao (~1)', () => {
  const last = new Date(NOW_MS).toISOString();
  assert.ok(Math.abs(computeConfidence(RELIABLE_ATTEMPTS, last, NOW_MS) - 1) < 1e-9);
  // vượt RELIABLE_ATTEMPTS vẫn kẹp 1
  assert.ok(Math.abs(computeConfidence(99, last, NOW_MS) - 1) < 1e-9);
});

test('computeConfidence: attempts ít → confidence thấp dù ôn tươi', () => {
  const last = new Date(NOW_MS).toISOString();
  // 1 câu / 5 = 0.2, tươi → 0.2
  assert.ok(Math.abs(computeConfidence(1, last, NOW_MS) - 0.2) < 1e-6);
});

test('computeConfidence: lâu không ôn → tươi giảm (half-life 30 ngày → ~0.5 sau 30 ngày)', () => {
  const fresh = computeConfidence(RELIABLE_ATTEMPTS, new Date(NOW_MS).toISOString(), NOW_MS);
  const staleMs = NOW_MS - CONFIDENCE_HALF_LIFE_DAYS * 86_400_000;
  const stale = computeConfidence(RELIABLE_ATTEMPTS, new Date(staleMs).toISOString(), NOW_MS);
  assert.ok(stale < fresh, 'ôm cũ < ôm tươi');
  // attemptsPart=1, freshPart=0.5^(30/30)=0.5 → ~0.5
  assert.ok(Math.abs(stale - 0.5) < 1e-6);
});

test('computeConfidence: lastSeen rác → 0 (không ném)', () => {
  assert.equal(computeConfidence(RELIABLE_ATTEMPTS, 'not-a-date', NOW_MS), 0);
});

// ── hasRetention ────────────────────────────────────────────────────────────

test('hasRetention: thiếu ngày → false', () => {
  assert.equal(hasRetention(undefined, undefined), false);
  assert.equal(hasRetention('2026-07-01', undefined), false);
  assert.equal(hasRetention(undefined, '2026-07-03'), false);
});

test('hasRetention: cùng ngày (chưa chứng minh bền) → false', () => {
  assert.equal(hasRetention('2026-07-01', '2026-07-01'), false);
});

test('hasRetention: đúng lại sau ≥1 ngày → true', () => {
  assert.equal(hasRetention('2026-07-01', '2026-07-02'), true);
  assert.equal(hasRetention('2026-07-01', '2026-07-10'), true);
});

test('hasRetention: cùng ngày nhưng string lệch giờ vẫn false (chỉ so ngày)', () => {
  assert.equal(hasRetention('2026-07-01', '2026-07-01'), false);
});

test('hasRetention: ngày rác → false (không ném)', () => {
  assert.equal(hasRetention('garbage', '2026-07-02'), false);
});

// ── isDurableMastered ───────────────────────────────────────────────────────

test('isDurableMastered: attempts < RELIABLE → false dù score 100 + retention', () => {
  assert.equal(
    isDurableMastered(
      skill({ score: 100, attempts: RELIABLE_ATTEMPTS - 1, firstCorrectDay: '2026-07-01', lastCorrectDay: '2026-07-05' })
    ),
    false
  );
});

test('isDurableMastered: score < threshold → false dù đủ attempts + retention', () => {
  assert.equal(
    isDurableMastered(
      skill({ score: MASTERED_THRESHOLD - 1, attempts: RELIABLE_ATTEMPTS, firstCorrectDay: '2026-07-01', lastCorrectDay: '2026-07-05' })
    ),
    false
  );
});

test('isDurableMastered: đủ attempts + score + retention → true', () => {
  assert.equal(
    isDurableMastered(
      skill({ score: MASTERED_THRESHOLD, attempts: RELIABLE_ATTEMPTS, firstCorrectDay: '2026-07-01', lastCorrectDay: '2026-07-05' })
    ),
    true
  );
});

test('isDurableMastered: dữ liệu CŨ thiếu field retention → false (chứng minh bền chưa rõ)', () => {
  // skill cũ: chỉ có score/attempts, không có firstCorrectDay/lastCorrectDay
  assert.equal(
    isDurableMastered(skill({ score: 90, attempts: 10 })),
    false
  );
});

// ── countDurableMastered ────────────────────────────────────────────────────

test('countDurableMastered: chỉ đếm skill THẬT trong taxonomy đạt durable', () => {
  // 'algebra.linear_eq' là skill thật trong SKILL_TREE. Cho nó đủ điều kiện durable.
  const skills: Record<string, SkillMastery> = {
    'algebra.linear_eq': skill({
      score: 90,
      attempts: RELIABLE_ATTEMPTS,
      firstCorrectDay: '2026-07-01',
      lastCorrectDay: '2026-07-05',
    }),
    // skill giả không có trong taxonomy → KHÔNG bị đếm (countDurableMastered lọc qua ALL_SKILLS)
    'fake.skill': skill({
      score: 100,
      attempts: 50,
      firstCorrectDay: '2026-07-01',
      lastCorrectDay: '2026-07-05',
    }),
  };
  const count = countDurableMastered(skills);
  assert.ok(count >= 1, 'ít nhất 1 skill thật đạt durable');
  assert.equal(count, 1, 'fake.skill không nằm trong ALL_SKILLS → không đếm');
});

test('countDurableMastered: không có skill nào đạt → 0', () => {
  assert.equal(countDurableMastered({}), 0);
});
