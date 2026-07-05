import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOnboarding, setOnboardingFlag, ONBOARDING_KEY } from './onboarding.ts';

test('readOnboarding: null khi skills rỗng / thiếu key', () => {
  assert.equal(readOnboarding(null), null);
  assert.equal(readOnboarding(undefined), null);
  assert.equal(readOnboarding({}), null);
  assert.equal(readOnboarding({ 'algebra.linear_eq': { score: 50 } }), null);
});

test('readOnboarding: null khi completed !== true', () => {
  assert.equal(readOnboarding({ [ONBOARDING_KEY]: { completed: false } }), null);
  assert.equal(readOnboarding({ [ONBOARDING_KEY]: {} }), null);
});

test('readOnboarding: parse trạng thái khi completed', () => {
  const state = readOnboarding({ [ONBOARDING_KEY]: { completed: true, completedAt: '2026-07-05T00:00:00Z', targetScore: 1400 } });
  assert.deepEqual(state, { completed: true, completedAt: '2026-07-05T00:00:00Z', targetScore: 1400 });
});

test('readOnboarding: targetScore optional (không có → không có field)', () => {
  const state = readOnboarding({ [ONBOARDING_KEY]: { completed: true, completedAt: 'x' } });
  assert.deepEqual(state, { completed: true, completedAt: 'x' });
});

test('setOnboardingFlag: ghi __onboarding__ không đụng key khác (round-trip mastery + __gates__)', () => {
  const skills: Record<string, unknown> = {
    'algebra.linear_eq': { score: 72, attempts: 5, correct: 4 },
    __gates__: { algebra: { passed: true, score: 4 } },
  };
  setOnboardingFlag(skills, { completedAt: '2026-07-05T00:00:00Z', targetScore: 1500 });

  // mastery + gates GIỮ NGUYÊN
  assert.deepEqual(skills['algebra.linear_eq'], { score: 72, attempts: 5, correct: 4 });
  assert.deepEqual(skills.__gates__, { algebra: { passed: true, score: 4 } });

  // cờ ghi đúng + đọc lại được
  const state = readOnboarding(skills);
  assert.equal(state?.completed, true);
  assert.equal(state?.targetScore, 1500);
});

test('setOnboardingFlag: bỏ qua targetScore khi không phải number', () => {
  const skills: Record<string, unknown> = {};
  setOnboardingFlag(skills, { completedAt: 'x' });
  const state = readOnboarding(skills);
  assert.equal(state?.completed, true);
  assert.equal(state?.targetScore, undefined);
});
