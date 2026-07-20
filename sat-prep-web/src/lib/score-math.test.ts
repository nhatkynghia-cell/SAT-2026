import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  masteryToScale,
  masteryToCEFR,
  cefrToScale,
  confidenceOf,
  clampTargetLevel,
  predictETA,
  SCALE_MIN,
  SCALE_MAX,
} from './score-math.ts';

test('masteryToScale: mastery 0 → sàn 82', () => {
  assert.equal(masteryToScale(0), SCALE_MIN);
});

test('masteryToScale: mastery 100 → trần 170', () => {
  assert.equal(masteryToScale(100), SCALE_MAX);
});

test('masteryToScale: mastery 50 → 126 (giữa thang, 82+44)', () => {
  assert.equal(masteryToScale(50), 126);
});

test('masteryToScale: clamp input ngoài [0,100]', () => {
  assert.equal(masteryToScale(-50), SCALE_MIN);
  assert.equal(masteryToScale(250), SCALE_MAX);
});

test('masteryToCEFR: ngưỡng 20/40/70 → Pre-A1/A1/A2/B1', () => {
  assert.equal(masteryToCEFR(0), 'Pre-A1');
  assert.equal(masteryToCEFR(19), 'Pre-A1');
  assert.equal(masteryToCEFR(20), 'A1');
  assert.equal(masteryToCEFR(39), 'A1');
  assert.equal(masteryToCEFR(40), 'A2');
  assert.equal(masteryToCEFR(69), 'A2');
  assert.equal(masteryToCEFR(70), 'B1');
  assert.equal(masteryToCEFR(100), 'B1');
});

test('cefrToScale: mốc neo Cambridge (A2=120, B1=140)', () => {
  assert.equal(cefrToScale('A2'), 120);
  assert.equal(cefrToScale('B1'), 140);
  assert.equal(cefrToScale('A1'), 110);
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

test('clampTargetLevel: chuẩn hoá về A1/A2/B1 (Pre-A1→A1, lạ→A2)', () => {
  assert.equal(clampTargetLevel('A1'), 'A1');
  assert.equal(clampTargetLevel('A2'), 'A2');
  assert.equal(clampTargetLevel('B1'), 'B1');
  assert.equal(clampTargetLevel('Pre-A1'), 'A1');
  assert.equal(clampTargetLevel('bịa'), 'A2');
});

test('predictETA: đã đạt mốc → reached, days 0', () => {
  assert.deepEqual(predictETA(140, 120, 0), { days: 0, reached: true });
});

test('predictETA: chưa có đà (perDay<=0) → days null', () => {
  assert.deepEqual(predictETA(100, 140, 0), { days: null, reached: false });
});

test('predictETA: tính số ngày theo tốc độ', () => {
  const r = predictETA(100, 140, 2); // cần 40 điểm, 2/ngày → 20 ngày
  assert.deepEqual(r, { days: 20, reached: false });
});
