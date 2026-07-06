import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotFromSummary, computeWeeklyTrend, type DailySnapshot } from './daily-snapshot.ts';

function mkSummary(math: number, reading: number, overall: number, attempts: number[]) {
  return { bySubject: { math, reading }, overall, skills: attempts.map((a) => ({ attempts: a })) };
}

test('buildSnapshotFromSummary: map mastery→section + tổng điểm + tổng attempts', () => {
  const snap = buildSnapshotFromSummary(mkSummary(50, 0, 25, [3, 2, 0, 5]));
  assert.equal(snap.math_section, 500); // masteryToSection(50)
  assert.equal(snap.reading_section, 200); // masteryToSection(0)
  assert.equal(snap.total_score, 700);
  assert.equal(snap.total_attempts, 10);
  assert.equal(snap.overall, 25);
});

function snap(date: string, total: number, attempts: number): DailySnapshot {
  return { snapshot_date: date, overall: 0, math_section: 0, reading_section: 0, total_score: total, total_attempts: attempts };
}

test('computeWeeklyTrend: rỗng khi không có snapshot trong cửa sổ', () => {
  const t = computeWeeklyTrend([], '2026-07-05');
  assert.equal(t.latestTotal, null);
  assert.equal(t.scoreDelta, 0);
  assert.equal(t.activeDays, 0);
  assert.deepEqual(t.series, []);
});

test('computeWeeklyTrend: delta điểm + câu tuần từ mốc cũ nhất→mới nhất', () => {
  const snaps = [
    snap('2026-06-28', 800, 10), // ngoài cửa sổ (today-6 = 06-29) → bỏ
    snap('2026-06-30', 900, 20),
    snap('2026-07-02', 1000, 35),
    snap('2026-07-05', 1100, 50),
  ];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.latestTotal, 1100);
  assert.equal(t.weekAgoTotal, 900); // 06-30 là cũ nhất TRONG cửa sổ
  assert.equal(t.scoreDelta, 200);
  assert.equal(t.attemptsThisWeek, 30); // 50 - 20
  assert.equal(t.activeDays, 3);
  assert.equal(t.series.length, 3);
  assert.equal(t.series[0].date, '2026-06-30');
});

test('computeWeeklyTrend: loại snapshot ngoài [today-6, today]', () => {
  const snaps = [snap('2026-07-10', 1200, 60), snap('2026-07-05', 1100, 50)];
  const t = computeWeeklyTrend(snaps, '2026-07-05'); // 07-10 là tương lai → loại
  assert.equal(t.activeDays, 1);
  assert.equal(t.latestTotal, 1100);
});

test('computeWeeklyTrend: attemptsThisWeek kẹp >= 0 (attempts không giảm bất thường)', () => {
  const snaps = [snap('2026-07-01', 1000, 40), snap('2026-07-05', 1000, 30)];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.attemptsThisWeek, 0);
});

test('computeWeeklyTrend: 1 snapshot duy nhất → delta 0, latest=weekAgo', () => {
  const t = computeWeeklyTrend([snap('2026-07-05', 1100, 50)], '2026-07-05');
  assert.equal(t.latestTotal, 1100);
  assert.equal(t.weekAgoTotal, 1100);
  assert.equal(t.scoreDelta, 0);
  assert.equal(t.activeDays, 1);
});

// ── windowDays (phân tầng báo cáo phụ huynh 2026-07-06): free 7, premium 30, ultimate 90 ──

test('computeWeeklyTrend: windowDays mặc định 7 → loại snapshot >7 ngày', () => {
  // 06-20 cách 07-05 là 15 ngày → ngoài cửa sổ 7 ngày mặc định.
  const snaps = [snap('2026-06-20', 1000, 30), snap('2026-07-05', 1200, 60)];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.activeDays, 1, 'chỉ snapshot 07-05 trong cửa sổ 7 ngày');
  assert.equal(t.scoreDelta, 0);
});

test('computeWeeklyTrend: windowDays=30 (premium) → bắt được snapshot 15 ngày trước', () => {
  const snaps = [snap('2026-06-20', 1000, 30), snap('2026-07-05', 1200, 60)];
  const t = computeWeeklyTrend(snaps, '2026-07-05', 30);
  assert.equal(t.activeDays, 2, 'cả 2 snapshot trong cửa sổ 30 ngày');
  assert.equal(t.weekAgoTotal, 1000, 'mốc cũ nhất = 06-20');
  assert.equal(t.scoreDelta, 200, 'delta 1200-1000 trong 30 ngày');
});

test('computeWeeklyTrend: windowDays=90 (ultimate) → bắt được snapshot ~60 ngày trước', () => {
  const snaps = [snap('2026-05-06', 900, 10), snap('2026-07-05', 1300, 80)];
  const t = computeWeeklyTrend(snaps, '2026-07-05', 90);
  assert.equal(t.activeDays, 2);
  assert.equal(t.scoreDelta, 400);
});
