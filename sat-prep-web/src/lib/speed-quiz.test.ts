import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  milestonesReached,
  rewardForRank,
  maxRewardedRank,
  cyclesEndingAt,
  SPEED_QUIZ_MILESTONES,
} from './speed-quiz.ts';

function utc(y: number, m: number, d: number, h = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h));
}

// ── milestonesReached ────────────────────────────────────────────────────────

test('milestonesReached: dưới mốc đầu → rỗng', () => {
  assert.deepEqual(milestonesReached(0), []);
  assert.deepEqual(milestonesReached(9), []);
});

test('milestonesReached: đúng mốc 10 → 1 mốc', () => {
  const r = milestonesReached(10);
  assert.equal(r.length, 1);
  assert.equal(r[0].correct, 10);
  assert.equal(r[0].coins, 100);
});

test('milestonesReached: 25 câu → đạt mốc 10 và 20 (chưa 30)', () => {
  const r = milestonesReached(25);
  assert.deepEqual(r.map((m) => m.correct), [10, 20]);
});

test('milestonesReached: 30+ câu → cả 3 mốc', () => {
  assert.equal(milestonesReached(30).length, 3);
  assert.equal(milestonesReached(100).length, 3);
});

test('SPEED_QUIZ_MILESTONES: tăng dần đúng số liệu chốt', () => {
  assert.deepEqual(
    SPEED_QUIZ_MILESTONES.map((m) => [m.correct, m.coins]),
    [[10, 100], [20, 250], [30, 500]]
  );
});

// ── rewardForRank ─────────────────────────────────────────────────────────────

test('rewardForRank: hạng 1 nhận bậc cao nhất', () => {
  assert.equal(rewardForRank('day', 1), 500);
  assert.equal(rewardForRank('week', 1), 2000);
  assert.equal(rewardForRank('month', 1), 8000);
  assert.equal(rewardForRank('year', 1), 50000);
});

test('rewardForRank: hạng trong ngưỡng giữa (top 3)', () => {
  assert.equal(rewardForRank('day', 2), 300);
  assert.equal(rewardForRank('day', 3), 300);
});

test('rewardForRank: hạng top 10', () => {
  assert.equal(rewardForRank('day', 4), 100);
  assert.equal(rewardForRank('day', 10), 100);
});

test('rewardForRank: ngoài top 10 → 0', () => {
  assert.equal(rewardForRank('day', 11), 0);
  assert.equal(rewardForRank('year', 50), 0);
});

test('rewardForRank: hạng không hợp lệ → 0', () => {
  assert.equal(rewardForRank('day', 0), 0);
  assert.equal(rewardForRank('day', -1), 0);
  assert.equal(rewardForRank('day', 1.5), 0);
});

test('maxRewardedRank: bằng ngưỡng lớn nhất (10 cho mọi cycle mặc định)', () => {
  assert.equal(maxRewardedRank('day'), 10);
  assert.equal(maxRewardedRank('year'), 10);
});

// ── cyclesEndingAt (cron chốt cuối kỳ) ───────────────────────────────────────

test('cyclesEndingAt: ngày thường (không phải đầu tuần/tháng/năm) → chỉ day', () => {
  // 2026-07-08 là thứ Tư VN → chỉ chu kỳ ngày vừa kết thúc.
  // now = 00:00 VN 8/7 = 17:00 UTC 7/7 (cron chạy 00:00 VN).
  const now = utc(2026, 7, 7, 17);
  const ends = cyclesEndingAt(now);
  assert.deepEqual(ends.map((e) => e.cycle), ['day']);
  // key chốt = ngày hôm trước (7/7).
  assert.equal(ends[0].key, '2026-07-07');
});

test('cyclesEndingAt: sáng thứ Hai VN → day + week', () => {
  // 2026-07-13 là thứ Hai VN. now = 00:00 VN 13/7 = 17:00 UTC 12/7.
  const now = utc(2026, 7, 12, 17);
  const ends = cyclesEndingAt(now);
  const cycles = ends.map((e) => e.cycle).sort();
  assert.deepEqual(cycles, ['day', 'week']);
  // Tuần vừa kết thúc = tuần của Chủ Nhật 12/7 = 2026-W28.
  const week = ends.find((e) => e.cycle === 'week');
  assert.equal(week?.key, '2026-W28');
});

test('cyclesEndingAt: 00:00 VN ngày 1 → day + month (thường kèm week nếu là thứ Hai)', () => {
  // 2026-08-01 VN. now = 00:00 VN 1/8 = 17:00 UTC 31/7.
  const now = utc(2026, 7, 31, 17);
  const ends = cyclesEndingAt(now);
  const cycles = new Set(ends.map((e) => e.cycle));
  assert.ok(cycles.has('day'));
  assert.ok(cycles.has('month'));
  const month = ends.find((e) => e.cycle === 'month');
  assert.equal(month?.key, '2026-07'); // tháng vừa kết thúc = tháng 7
});

test('cyclesEndingAt: 00:00 VN 1/1 → day + month + year (+ week nếu thứ Hai)', () => {
  // 2027-01-01 VN. now = 00:00 VN 1/1 = 17:00 UTC 31/12/2026.
  const now = utc(2026, 12, 31, 17);
  const ends = cyclesEndingAt(now);
  const cycles = new Set(ends.map((e) => e.cycle));
  assert.ok(cycles.has('day'));
  assert.ok(cycles.has('month'));
  assert.ok(cycles.has('year'));
  const year = ends.find((e) => e.cycle === 'year');
  assert.equal(year?.key, '2026'); // năm vừa kết thúc = 2026
  const month = ends.find((e) => e.cycle === 'month');
  assert.equal(month?.key, '2026-12');
});
