import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentSeasonKey,
  getSeasonLabel,
  daysLeftInSeason,
} from './season.ts';

// Helper: tạo Date từ UTC (test xác định).
function utc(y: number, m: number, d: number, h = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h));
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
