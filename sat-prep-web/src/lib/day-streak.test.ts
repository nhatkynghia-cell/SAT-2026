import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDayStreak,
  pendingStreakGrant,
  STREAK_MILESTONE_REWARD,
} from './day-streak.ts';

// ── computeDayStreak ─────────────────────────────────────────────────────────

test('computeDayStreak: mảng rỗng → 0', () => {
  assert.equal(computeDayStreak([], '2026-07-08'), 0);
});

test('computeDayStreak: học đúng hôm nay, 1 ngày → 1', () => {
  assert.equal(computeDayStreak(['2026-07-08'], '2026-07-08'), 1);
});

test('computeDayStreak: chuỗi 3 ngày liên tiếp kết thúc hôm nay → 3', () => {
  assert.equal(computeDayStreak(['2026-07-06', '2026-07-07', '2026-07-08'], '2026-07-08'), 3);
});

test('computeDayStreak: ngày gần nhất là HÔM QUA (chưa học hôm nay) → chuỗi vẫn sống', () => {
  // hôm qua + hôm kia = 2, chuỗi còn sống vì gần nhất là yesterday
  assert.equal(computeDayStreak(['2026-07-06', '2026-07-07'], '2026-07-08'), 2);
});

test('computeDayStreak: ngày gần nhất CŨ HƠN hôm qua → gãy, về 0', () => {
  assert.equal(computeDayStreak(['2026-07-05', '2026-07-06'], '2026-07-08'), 0);
});

test('computeDayStreak: đứt quãng giữa chừng → chỉ đếm đoạn liền hôm nay', () => {
  // 08,07 liền (2); 05 cách quãng (bỏ 06) → dừng ở 2
  assert.equal(computeDayStreak(['2026-07-05', '2026-07-07', '2026-07-08'], '2026-07-08'), 2);
});

test('computeDayStreak: ngày trùng lặp → dedupe, không đội chuỗi', () => {
  assert.equal(computeDayStreak(['2026-07-08', '2026-07-08', '2026-07-07'], '2026-07-08'), 2);
});

test('computeDayStreak: thứ tự lộn xộn → tự sort đúng', () => {
  assert.equal(computeDayStreak(['2026-07-08', '2026-07-06', '2026-07-07'], '2026-07-08'), 3);
});

test('computeDayStreak: ngày tương lai bị bỏ qua (không tin data vượt hôm nay)', () => {
  assert.equal(computeDayStreak(['2026-07-09', '2026-07-08'], '2026-07-08'), 1);
});

test('computeDayStreak: qua ranh giới tháng vẫn liên tiếp', () => {
  assert.equal(computeDayStreak(['2026-06-30', '2026-07-01'], '2026-07-01'), 2);
});

test('computeDayStreak: chuỗi tương lai đơn lẻ (data lỗi) → 0', () => {
  assert.equal(computeDayStreak(['2026-07-20'], '2026-07-08'), 0);
});

test('computeDayStreak: ngày sai định dạng bị bỏ qua', () => {
  assert.equal(computeDayStreak(['rác', '2026-07-08'], '2026-07-08'), 1);
});

// ── pendingStreakGrant ───────────────────────────────────────────────────────

test('pendingStreakGrant: chưa đạt mốc nào → rỗng', () => {
  const r = pendingStreakGrant(5, []);
  assert.deepEqual(r.milestones, []);
  assert.equal(r.coins, 0);
});

test('pendingStreakGrant: đạt mốc 7 lần đầu → grant 200 xu', () => {
  const r = pendingStreakGrant(7, []);
  assert.deepEqual(r.milestones, [7]);
  assert.equal(r.coins, STREAK_MILESTONE_REWARD[7]);
});

test('pendingStreakGrant: đã nhận mốc 7 → không nhận lại (idempotent)', () => {
  const r = pendingStreakGrant(10, ['7']);
  assert.deepEqual(r.milestones, []);
  assert.equal(r.coins, 0);
});

test('pendingStreakGrant: nhảy thẳng từ 0 lên >=30 (chưa nhận gì) → gộp mốc 7 + 30', () => {
  const r = pendingStreakGrant(35, []);
  assert.deepEqual(r.milestones.sort((a, b) => a - b), [7, 30]);
  assert.equal(r.coins, STREAK_MILESTONE_REWARD[7] + STREAK_MILESTONE_REWARD[30]);
});

test('pendingStreakGrant: đạt 100, đã nhận 7+30 → chỉ còn mốc 100', () => {
  const r = pendingStreakGrant(100, ['7', '30']);
  assert.deepEqual(r.milestones, [100]);
  assert.equal(r.coins, STREAK_MILESTONE_REWARD[100]);
});

test('pendingStreakGrant: đã nhận hết mốc → rỗng dù streak rất dài', () => {
  const r = pendingStreakGrant(365, ['7', '30', '100']);
  assert.deepEqual(r.milestones, []);
  assert.equal(r.coins, 0);
});

test('pendingStreakGrant: claimed rác (không phải số) bị lọc, vẫn grant đúng', () => {
  const r = pendingStreakGrant(7, ['abc', '']);
  assert.deepEqual(r.milestones, [7]);
  assert.equal(r.coins, STREAK_MILESTONE_REWARD[7]);
});
