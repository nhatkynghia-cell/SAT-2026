import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentSeasonKey,
  getSeasonLabel,
  daysLeftInSeason,
  getCycleKey,
  getCycleLabel,
  msLeftInCycle,
} from './season.ts';

// Helper: tạo Date từ UTC (test xác định).
function utc(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min));
}

// ── getCurrentSeasonKey (theo giờ VN UTC+7) ──────────────────────────────────

test('getCurrentSeasonKey: giữa tháng → YYYY-MM', () => {
  assert.equal(getCurrentSeasonKey(utc(2026, 7, 8, 3)), '2026-07');
});

test('getCurrentSeasonKey: tháng 1 số 0 đằng trước', () => {
  assert.equal(getCurrentSeasonKey(utc(2026, 1, 15)), '2026-01');
});

test('getCurrentSeasonKey: cuối tháng UTC nhưng +7h sang tháng mới VN', () => {
  // 2026-06-30 20:00 UTC → +7h = 2026-07-01 03:00 VN → mùa tháng 7.
  assert.equal(getCurrentSeasonKey(utc(2026, 6, 30, 20)), '2026-07');
});

test('getCurrentSeasonKey: đầu tháng UTC vẫn cùng tháng VN', () => {
  // 2026-07-01 00:00 UTC → +7h = 2026-07-01 07:00 VN → tháng 7.
  assert.equal(getCurrentSeasonKey(utc(2026, 7, 1, 0)), '2026-07');
});

test('getCurrentSeasonKey: cuối năm UTC +7h sang năm mới', () => {
  // 2026-12-31 18:00 UTC → +7h = 2027-01-01 01:00 VN.
  assert.equal(getCurrentSeasonKey(utc(2026, 12, 31, 18)), '2027-01');
});

// ── getSeasonLabel ───────────────────────────────────────────────────────────

test('getSeasonLabel: format tiếng Việt', () => {
  assert.equal(getSeasonLabel('2026-07'), 'Mùa Tháng 7/2026');
  assert.equal(getSeasonLabel('2026-01'), 'Mùa Tháng 1/2026');
  assert.equal(getSeasonLabel('2026-12'), 'Mùa Tháng 12/2026');
});

test('getSeasonLabel: key sai định dạng → trả nguyên key (không crash)', () => {
  assert.equal(getSeasonLabel('rác'), 'rác');
  assert.equal(getSeasonLabel('2026-13'), '2026-13'); // tháng 13 không hợp lệ
});

// ── daysLeftInSeason ─────────────────────────────────────────────────────────

test('daysLeftInSeason: giữa tháng 7 (31 ngày), ngày 8 → còn 24', () => {
  // 31 - 8 + 1 = 24
  assert.equal(daysLeftInSeason(utc(2026, 7, 8, 3)), 24);
});

test('daysLeftInSeason: ngày cuối tháng → 1', () => {
  assert.equal(daysLeftInSeason(utc(2026, 7, 31, 3)), 1);
});

test('daysLeftInSeason: tháng 2 năm nhuận (2028, 29 ngày)', () => {
  // 2028 nhuận: 29 - 1 + 1 = 29
  assert.equal(daysLeftInSeason(utc(2028, 2, 1, 3)), 29);
});

test('daysLeftInSeason: tháng 2 năm thường (2026, 28 ngày)', () => {
  assert.equal(daysLeftInSeason(utc(2026, 2, 28, 3)), 1);
});

// ── getCycleKey (day/week/month/year, giờ VN UTC+7) ──────────────────────────

test('getCycleKey day: YYYY-MM-DD theo giờ VN', () => {
  assert.equal(getCycleKey(utc(2026, 7, 8, 3), 'day'), '2026-07-08');
});

test('getCycleKey day: cuối ngày UTC +7h sang ngày mới VN', () => {
  // 2026-06-30 20:00 UTC → +7h = 2026-07-01 03:00 VN.
  assert.equal(getCycleKey(utc(2026, 6, 30, 20), 'day'), '2026-07-01');
});

test('getCycleKey month: khớp getCurrentSeasonKey', () => {
  assert.equal(getCycleKey(utc(2026, 7, 8, 3), 'month'), '2026-07');
});

test('getCycleKey year: YYYY theo giờ VN', () => {
  assert.equal(getCycleKey(utc(2026, 7, 8, 3), 'year'), '2026');
  // 2026-12-31 18:00 UTC → +7h = 2027-01-01 01:00 VN → năm 2027.
  assert.equal(getCycleKey(utc(2026, 12, 31, 18), 'year'), '2027');
});

test('getCycleKey week: tuần ISO giữa năm', () => {
  // 2026-07-08 là thứ Tư → tuần ISO 28 của 2026.
  assert.equal(getCycleKey(utc(2026, 7, 8, 3), 'week'), '2026-W28');
});

test('getCycleKey week: ranh giới năm → tuần cuối năm trước (ISO)', () => {
  // 2027-01-01 (VN) là thứ Sáu → thuộc tuần 53 của năm-tuần ISO 2026.
  assert.equal(getCycleKey(utc(2026, 12, 31, 18), 'week'), '2026-W53');
});

// ── getCycleLabel ────────────────────────────────────────────────────────────

test('getCycleLabel: nhãn tiếng Việt từng cycle', () => {
  assert.equal(getCycleLabel('2026-07-08', 'day'), 'Ngày 8/7/2026');
  assert.equal(getCycleLabel('2026-W28', 'week'), 'Tuần 28/2026');
  assert.equal(getCycleLabel('2026-07', 'month'), 'Mùa Tháng 7/2026');
  assert.equal(getCycleLabel('2026', 'year'), 'Năm 2026');
});

test('getCycleLabel: key sai định dạng → trả nguyên key', () => {
  assert.equal(getCycleLabel('rác', 'day'), 'rác');
  assert.equal(getCycleLabel('2026-99', 'week'), '2026-99');
});

// ── msLeftInCycle (đếm ngược, giờ VN) ────────────────────────────────────────

test('msLeftInCycle day: 10:00 VN → còn 14 giờ tới 00:00 VN hôm sau', () => {
  // now = 2026-07-08 03:00 UTC = 10:00 VN → tới 00:00 VN 9/7 = 14h.
  assert.equal(msLeftInCycle(utc(2026, 7, 8, 3), 'day'), 14 * 3600 * 1000);
});

test('msLeftInCycle month: 10:00 VN 30/7 → còn 38 giờ tới 00:00 VN 1/8', () => {
  // now = 2026-07-30 03:00 UTC = 10:00 VN 30/7 → 1 ngày 14h = 38h.
  assert.equal(msLeftInCycle(utc(2026, 7, 30, 3), 'month'), 38 * 3600 * 1000);
});

test('msLeftInCycle week: thứ Tư 10:00 VN → còn 4 ngày 14 giờ tới thứ Hai kế', () => {
  // 2026-07-08 thứ Tw → thứ Hai kế 13/7 00:00 VN = 4 ngày 14h = 110h.
  assert.equal(msLeftInCycle(utc(2026, 7, 8, 3), 'week'), 110 * 3600 * 1000);
});

test('msLeftInCycle year: luôn dương và ≤ 366 ngày', () => {
  const ms = msLeftInCycle(utc(2026, 7, 8, 3), 'year');
  assert.ok(ms > 0);
  assert.ok(ms <= 366 * 86400000);
});

test('msLeftInCycle: mọi cycle đều dương ở sát cuối ngày VN', () => {
  // 2026-07-08 16:30 UTC = 23:30 VN → còn 30 phút hết ngày.
  for (const c of ['day', 'week', 'month', 'year'] as const) {
    assert.ok(msLeftInCycle(utc(2026, 7, 8, 16, 30), c) > 0, `${c} phải > 0`);
  }
  assert.equal(msLeftInCycle(utc(2026, 7, 8, 16, 30), 'day'), 30 * 60 * 1000);
});
