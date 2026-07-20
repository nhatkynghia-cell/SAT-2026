import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotFromSummary, computeWeeklyTrend, type DailySnapshot } from './daily-snapshot.ts';

function mkSummary(overall: number, attempts: number[]) {
  return { overall, skills: attempts.map((a) => ({ attempts: a })) };
}

test('buildSnapshotFromSummary: map overall→scale + cefr + tổng attempts', () => {
  const snap = buildSnapshotFromSummary(mkSummary(50, [3, 2, 0, 5]));
  assert.equal(snap.overall_scale, 126); // masteryToScale(50) = 82 + 44
  assert.equal(snap.cefr, 'A2'); // masteryToCEFR(50)
  assert.equal(snap.total_attempts, 10);
  assert.equal(snap.overall, 50);
});

test('KIỂM CHÉO: inline masteryToScale (daily-snapshot) === công thức 82+round(m*0.88)', () => {
  for (const m of [0, 20, 40, 50, 70, 100]) {
    const snap = buildSnapshotFromSummary(mkSummary(m, [1]));
    assert.equal(snap.overall_scale, 82 + Math.round(m * 0.88), `lệch tại mastery ${m}`);
  }
});

function snap(date: string, scale: number, attempts: number): DailySnapshot {
  return { snapshot_date: date, overall: 0, overall_scale: scale, cefr: 'A2', total_attempts: attempts };
}

test('computeWeeklyTrend: rỗng khi không có snapshot trong cửa sổ', () => {
  const t = computeWeeklyTrend([], '2026-07-05');
  assert.equal(t.latestScale, null);
  assert.equal(t.scoreDelta, 0);
  assert.equal(t.activeDays, 0);
  assert.deepEqual(t.series, []);
});

test('computeWeeklyTrend: delta scale + câu tuần từ mốc cũ nhất→mới nhất', () => {
  const snaps = [
    snap('2026-06-28', 120, 10), // ngoài cửa sổ → bỏ
    snap('2026-06-30', 126, 20),
    snap('2026-07-02', 132, 35),
    snap('2026-07-05', 140, 50),
  ];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.latestScale, 140);
  assert.equal(t.weekAgoScale, 126);
  assert.equal(t.scoreDelta, 14);
  assert.equal(t.attemptsThisWeek, 30);
  assert.equal(t.activeDays, 3);
  assert.equal(t.series.length, 3);
  assert.equal(t.series[0].date, '2026-06-30');
});

test('computeWeeklyTrend: loại snapshot ngoài [today-6, today]', () => {
  const snaps = [snap('2026-07-10', 150, 60), snap('2026-07-05', 140, 50)];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.activeDays, 1);
  assert.equal(t.latestScale, 140);
});

test('computeWeeklyTrend: attemptsThisWeek kẹp >= 0', () => {
  const snaps = [snap('2026-07-01', 130, 40), snap('2026-07-05', 130, 30)];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.attemptsThisWeek, 0);
});

test('computeWeeklyTrend: 1 snapshot duy nhất → delta 0, latest=weekAgo', () => {
  const t = computeWeeklyTrend([snap('2026-07-05', 140, 50)], '2026-07-05');
  assert.equal(t.latestScale, 140);
  assert.equal(t.weekAgoScale, 140);
  assert.equal(t.scoreDelta, 0);
  assert.equal(t.activeDays, 1);
});

test('computeWeeklyTrend: windowDays mặc định 7 → loại snapshot >7 ngày', () => {
  const snaps = [snap('2026-06-20', 126, 30), snap('2026-07-05', 150, 60)];
  const t = computeWeeklyTrend(snaps, '2026-07-05');
  assert.equal(t.activeDays, 1);
  assert.equal(t.scoreDelta, 0);
});

test('computeWeeklyTrend: windowDays=30 (premium) → bắt snapshot 15 ngày trước', () => {
  const snaps = [snap('2026-06-20', 126, 30), snap('2026-07-05', 150, 60)];
  const t = computeWeeklyTrend(snaps, '2026-07-05', 30);
  assert.equal(t.activeDays, 2);
  assert.equal(t.weekAgoScale, 126);
  assert.equal(t.scoreDelta, 24);
});

test('computeWeeklyTrend: windowDays=90 (ultimate) → bắt snapshot ~60 ngày trước', () => {
  const snaps = [snap('2026-05-06', 100, 10), snap('2026-07-05', 160, 80)];
  const t = computeWeeklyTrend(snaps, '2026-07-05', 90);
  assert.equal(t.activeDays, 2);
  assert.equal(t.scoreDelta, 60);
});
