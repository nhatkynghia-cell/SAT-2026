import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  masteryToSection,
  confidenceOf,
  clampTargetScore,
  SECTION_MIN,
  SECTION_MAX,
} from './score-math.ts';

test('masteryToSection: mastery 0 → sàn SAT 200', () => {
  assert.equal(masteryToSection(0), SECTION_MIN);
});

test('masteryToSection: mastery 100 → trần SAT 800', () => {
  assert.equal(masteryToSection(100), SECTION_MAX);
});

test('masteryToSection: mastery 50 → 500 (giữa thang)', () => {
  assert.equal(masteryToSection(50), 500);
});

test('masteryToSection: luôn làm tròn về bội số 10', () => {
  for (const m of [13, 27, 41, 68, 99]) {
    assert.equal(masteryToSection(m) % 10, 0);
  }
});

test('masteryToSection: clamp input ngoài [0,100] (không vượt sàn/trần)', () => {
  assert.equal(masteryToSection(-50), SECTION_MIN);
  assert.equal(masteryToSection(250), SECTION_MAX);
});

test('confidenceOf: <20 câu → low', () => {
  assert.equal(confidenceOf(0), 'low');
  assert.equal(confidenceOf(19), 'low');
});

test('confidenceOf: 20..59 câu → medium', () => {
  assert.equal(confidenceOf(20), 'medium');
  assert.equal(confidenceOf(59), 'medium');
});

test('confidenceOf: ≥60 câu → high', () => {
  assert.equal(confidenceOf(60), 'high');
  assert.equal(confidenceOf(200), 'high');
});

test('clampTargetScore: kẹp về [400,1600]', () => {
  assert.equal(clampTargetScore(100), 400);
  assert.equal(clampTargetScore(2000), 1600);
});

test('clampTargetScore: làm tròn bội số 10 trong khoảng hợp lệ', () => {
  assert.equal(clampTargetScore(1234), 1230);
  assert.equal(clampTargetScore(1236), 1240);
});
