import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promote, nextReview, isDue, BOX_INTERVALS, MAX_BOX, todayStr, adaptiveInterval } from './leitner.ts';

test('promote: nhớ thì lên 1 box', () => {
  assert.equal(promote(1, true), 2);
  assert.equal(promote(3, true), 4);
});

test('promote: nhớ ở box tối đa thì giữ nguyên MAX_BOX', () => {
  assert.equal(promote(MAX_BOX, true), MAX_BOX);
  assert.equal(promote(5, true), 5);
});

test('promote: quên thì rớt về box 1 (từ bất kỳ box nào)', () => {
  assert.equal(promote(2, false), 1);
  assert.equal(promote(5, false), 1);
  assert.equal(promote(1, false), 1);
});

test('nextReview: ngày ôn kế tiếp cách đúng số ngày của box (tất định, trục VN)', () => {
  // Mốc cố định: 2026-07-11 09:00 UTC → +7h = 2026-07-11 16:00 VN → ngày VN 07-11.
  const nowMs = Date.UTC(2026, 6, 11, 9, 0, 0);
  const expected = { 1: '2026-07-12', 2: '2026-07-13', 3: '2026-07-15', 4: '2026-07-18', 5: '2026-07-25' };
  for (const box of [1, 2, 3, 4, 5]) {
    assert.equal(nextReview(box, nowMs), expected[box]);
  }
});

test('nextReview: cộng ngày trên TRỤC VN (mốc UTC lệch ngày với VN)', () => {
  // 2026-07-11 20:00 UTC → +7h = 2026-07-12 03:00 VN → ngày VN 07-12 (KHÔNG phải 07-11).
  // Box 1 (+1) → 2026-07-13. Nếu tính trên UTC thuần sẽ ra 07-12 (sai 1 ngày).
  const nowMs = Date.UTC(2026, 6, 11, 20, 0, 0);
  assert.equal(nextReview(1, nowMs), '2026-07-13');
});

test('isDue: ngày trong quá khứ → đến hạn', () => {
  assert.equal(isDue('2020-01-01'), true);
});

test('isDue: chưa có lịch (undefined) → coi như đến hạn', () => {
  assert.equal(isDue(undefined), true);
});

test('isDue: ngày tương lai → chưa đến hạn', () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  assert.equal(isDue(future.toISOString().split('T')[0]), false);
});

test('isDue: đúng hôm nay → đến hạn (<=)', () => {
  assert.equal(isDue(todayStr()), true);
});

// ── Ranh giới ngày VN (UTC+7) — cổng cấp xu vocab (wasDue) lật lúc 00:00 VN ──

test('todayStr: tính theo GIỜ VN, ngày lật lúc 17:00 UTC (= 00:00 VN)', () => {
  // 16:59 UTC → VN 23:59 (vẫn hôm nay); 17:00 UTC → VN 00:00 (đã sang ngày mới).
  assert.equal(todayStr(Date.UTC(2026, 6, 11, 16, 59)), '2026-07-11');
  assert.equal(todayStr(Date.UTC(2026, 6, 11, 17, 0)), '2026-07-12');
});

test('todayStr: trong cửa sổ 00:00–07:00 VN, ngày VN ĐI TRƯỚC ngày UTC', () => {
  // 2026-07-11 22:45 UTC (thời điểm phiên này) → +7h = 2026-07-12 05:45 VN.
  // UTC date = 07-11 nhưng ngày VN = 07-12. todayStr phải trả ngày VN.
  assert.equal(todayStr(Date.UTC(2026, 6, 11, 22, 45)), '2026-07-12');
});

test('isDue: mục đặt lịch hôm nay VN → đến hạn ngay từ 00:00 VN (không trễ tới 07:00)', () => {
  // 17:05 UTC = 00:05 VN ngày 07-12. Mục next_review=07-12 phải due NGAY.
  const nowMs = Date.UTC(2026, 6, 11, 17, 5);
  assert.equal(isDue('2026-07-12', todayStr(nowMs)), true);
});

test('BOX_INTERVALS: đúng dãy Leitner 1,2,4,7,14', () => {
  assert.deepEqual(BOX_INTERVALS, { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });
});

// ── adaptiveInterval: nới khoảng ôn theo số lần nhớ liên tiếp ──────────────

test('adaptiveInterval: 0-2 đúng liên tiếp → khoảng mặc định', () => {
  assert.equal(adaptiveInterval(3, 0), BOX_INTERVALS[3]);
  assert.equal(adaptiveInterval(3, 2), BOX_INTERVALS[3]);
  assert.equal(adaptiveInterval(5, 1), BOX_INTERVALS[5]);
});

test('adaptiveInterval: 3-5 đúng liên tiếp → +1 ngày (ôm chắc → thưa)', () => {
  assert.equal(adaptiveInterval(3, 3), BOX_INTERVALS[3] + 1);
  assert.equal(adaptiveInterval(3, 5), BOX_INTERVALS[3] + 1);
});

test('adaptiveInterval: 6+ đúng liên tiếp → +2 ngày', () => {
  assert.equal(adaptiveInterval(4, 6), BOX_INTERVALS[4] + 2);
  assert.equal(adaptiveInterval(4, 99), BOX_INTERVALS[4] + 2);
});

test('nextReview: truyền consecutiveCorrect nới ngày ôn', () => {
  const nowMs = Date.UTC(2026, 6, 11, 9, 0, 0); // ngày VN 07-11
  // box 3 mặc định +4 → 07-15; consecutiveCorrect=6 → +6 → 07-17.
  assert.equal(nextReview(3, nowMs, 0), '2026-07-15');
  assert.equal(nextReview(3, nowMs, 6), '2026-07-17');
});

test('nextReview: không truyền consecutiveCorrect → giữ hành vi mặc định (tương thích)', () => {
  const nowMs = Date.UTC(2026, 6, 11, 9, 0, 0);
  assert.equal(nextReview(3, nowMs), '2026-07-15');
});
