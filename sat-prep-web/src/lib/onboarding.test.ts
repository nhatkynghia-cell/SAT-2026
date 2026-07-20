import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOnboarding, setOnboardingFlag, ONBOARDING_KEY } from './onboarding.ts';

test('readOnboarding: null khi skills rỗng / thiếu key', () => {
  assert.equal(readOnboarding(null), null);
  assert.equal(readOnboarding(undefined), null);
  assert.equal(readOnboarding({}), null);
  assert.equal(readOnboarding({ 'reading.notice_mcq': { score: 50 } }), null);
});

test('readOnboarding: null khi completed !== true', () => {
  assert.equal(readOnboarding({ [ONBOARDING_KEY]: { completed: false } }), null);
  assert.equal(readOnboarding({ [ONBOARDING_KEY]: {} }), null);
});

test('readOnboarding: parse trạng thái khi completed', () => {
  const state = readOnboarding({ [ONBOARDING_KEY]: { completed: true, completedAt: '2026-07-05T00:00:00Z', targetLevel: 'B1' } });
  assert.deepEqual(state, { completed: true, completedAt: '2026-07-05T00:00:00Z', targetLevel: 'B1' });
});

test('readOnboarding: targetLevel optional (không có → không có field)', () => {
  const state = readOnboarding({ [ONBOARDING_KEY]: { completed: true, completedAt: 'x' } });
  assert.deepEqual(state, { completed: true, completedAt: 'x' });
});

test('readOnboarding: bỏ qua targetLevel không hợp lệ', () => {
  const state = readOnboarding({ [ONBOARDING_KEY]: { completed: true, completedAt: 'x', targetLevel: 'C2' } });
  assert.deepEqual(state, { completed: true, completedAt: 'x' });
});

test('setOnboardingFlag: ghi __onboarding__ không đụng key khác (round-trip mastery + __gates__)', () => {
  const skills: Record<string, unknown> = {
    'reading.notice_mcq': { score: 72, attempts: 5, correct: 4 },
    __gates__: { grammar: { passed: true, score: 4 } },
  };
  setOnboardingFlag(skills, { completedAt: '2026-07-05T00:00:00Z', targetLevel: 'A2' });

  // mastery + gates GIỮ NGUYÊN
  assert.deepEqual(skills['reading.notice_mcq'], { score: 72, attempts: 5, correct: 4 });
  assert.deepEqual(skills.__gates__, { grammar: { passed: true, score: 4 } });

  // cờ ghi đúng + đọc lại được
  const state = readOnboarding(skills);
  assert.equal(state?.completed, true);
  assert.equal(state?.targetLevel, 'A2');
});

test('setOnboardingFlag: bỏ qua targetLevel khi không truyền', () => {
  const skills: Record<string, unknown> = {};
  setOnboardingFlag(skills, { completedAt: 'x' });
  const state = readOnboarding(skills);
  assert.equal(state?.completed, true);
  assert.equal(state?.targetLevel, undefined);
});
