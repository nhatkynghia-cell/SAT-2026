import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGateEligible,
  isRetryAllowed,
  evaluateGateResult,
  bumpDomainGateProgress,
  GATE_PASS_THRESHOLD,
  GATE_QUESTIONS,
  RETRY_CORRECT_NEEDED,
  GATE_DOMAIN_THRESHOLD,
  GATES_KEY,
  type GateProgress,
} from './gate-exam.ts';

describe('gate-exam — isGateEligible', () => {
  test('eligible when avg >= threshold and no prior attempt', () => {
    assert.equal(isGateEligible(GATE_DOMAIN_THRESHOLD, undefined), true);
    assert.equal(isGateEligible(GATE_DOMAIN_THRESHOLD + 20, undefined), true);
  });

  test('not eligible when avg below threshold', () => {
    assert.equal(isGateEligible(GATE_DOMAIN_THRESHOLD - 1, undefined), false);
    assert.equal(isGateEligible(0, undefined), false);
  });

  test('not eligible when already passed', () => {
    const gate: GateProgress = { passed: true, lastAttempt: '2026-01-01', score: 5, correctSinceFail: 0 };
    assert.equal(isGateEligible(80, gate), false);
  });

  test('not eligible when failed and not enough practice', () => {
    const gate: GateProgress = { passed: false, lastAttempt: '2026-01-01', score: 2, correctSinceFail: 5 };
    assert.equal(isGateEligible(80, gate), false);
  });

  test('eligible when failed but practiced enough', () => {
    const gate: GateProgress = { passed: false, lastAttempt: '2026-01-01', score: 2, correctSinceFail: RETRY_CORRECT_NEEDED };
    assert.equal(isGateEligible(80, gate), true);
  });
});

describe('gate-exam — isRetryAllowed', () => {
  test('allowed on first attempt (no gate record)', () => {
    assert.equal(isRetryAllowed(undefined), true);
  });

  test('not allowed when passed', () => {
    const gate: GateProgress = { passed: true, lastAttempt: '2026-01-01', score: 5, correctSinceFail: 99 };
    assert.equal(isRetryAllowed(gate), false);
  });

  test('not allowed when correctSinceFail < threshold', () => {
    const gate: GateProgress = { passed: false, lastAttempt: '2026-01-01', score: 1, correctSinceFail: RETRY_CORRECT_NEEDED - 1 };
    assert.equal(isRetryAllowed(gate), false);
  });

  test('allowed when correctSinceFail >= threshold', () => {
    const gate: GateProgress = { passed: false, lastAttempt: '2026-01-01', score: 1, correctSinceFail: RETRY_CORRECT_NEEDED };
    assert.equal(isRetryAllowed(gate), true);
  });
});

describe('gate-exam — evaluateGateResult', () => {
  test('5/5 = passed, not near-miss', () => {
    const r = evaluateGateResult(5);
    assert.equal(r.passed, true);
    assert.equal(r.nearMiss, false);
    assert.equal(r.score, 5);
  });

  test('4/5 = passed (threshold), not near-miss', () => {
    const r = evaluateGateResult(GATE_PASS_THRESHOLD);
    assert.equal(r.passed, true);
    assert.equal(r.nearMiss, false);
    assert.equal(r.score, GATE_PASS_THRESHOLD);
  });

  test('3/5 = near-miss, not passed', () => {
    const r = evaluateGateResult(GATE_PASS_THRESHOLD - 1);
    assert.equal(r.passed, false);
    assert.equal(r.nearMiss, true);
    assert.equal(r.score, GATE_PASS_THRESHOLD - 1);
  });

  test('2/5 = fail, not near-miss', () => {
    const r = evaluateGateResult(2);
    assert.equal(r.passed, false);
    assert.equal(r.nearMiss, false);
    assert.equal(r.score, 2);
  });

  test('0/5 = fail', () => {
    const r = evaluateGateResult(0);
    assert.equal(r.passed, false);
    assert.equal(r.nearMiss, false);
    assert.equal(r.score, 0);
  });

  test('clamps to 0..GATE_QUESTIONS', () => {
    assert.equal(evaluateGateResult(-3).score, 0);
    assert.equal(evaluateGateResult(99).score, GATE_QUESTIONS);
  });
});

describe('gate-exam — bumpDomainGateProgress', () => {
  function withGate(gate: GateProgress | undefined): Record<string, unknown> {
    const skills: Record<string, unknown> = { 'algebra.linear_eq': { score: 50 } };
    if (gate) skills[GATES_KEY] = { algebra: gate };
    return skills;
  }

  test('no-op (false) khi chương chưa từng thi (không có gate)', () => {
    const skills = withGate(undefined);
    assert.equal(bumpDomainGateProgress(skills, 'algebra'), false);
  });

  test('no-op (false) khi gate đã pass', () => {
    const skills = withGate({ passed: true, lastAttempt: 'x', score: 5, correctSinceFail: 0 });
    assert.equal(bumpDomainGateProgress(skills, 'algebra'), false);
    assert.equal((skills[GATES_KEY] as Record<string, GateProgress>).algebra.correctSinceFail, 0);
  });

  test('tăng correctSinceFail khi gate đã trượt', () => {
    const skills = withGate({ passed: false, lastAttempt: 'x', score: 2, correctSinceFail: 3 });
    assert.equal(bumpDomainGateProgress(skills, 'algebra'), true);
    assert.equal((skills[GATES_KEY] as Record<string, GateProgress>).algebra.correctSinceFail, 4);
  });

  test('no-op khi domain khác không có gate', () => {
    const skills = withGate({ passed: false, lastAttempt: 'x', score: 2, correctSinceFail: 3 });
    assert.equal(bumpDomainGateProgress(skills, 'geometry'), false);
  });
});
