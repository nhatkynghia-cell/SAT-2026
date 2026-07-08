import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankEntries, type RankRow } from './leaderboard.ts';

const rows: RankRow[] = [
  { userId: 'u1', nickname: 'Alpha', basePower: 80 },
  { userId: 'u2', nickname: 'Beta', basePower: 95 },
  { userId: 'u3', nickname: 'Gamma', basePower: 60 },
  { userId: 'u4', nickname: 'Delta', basePower: 95 }, // trùng basePower với Beta
];

test('rankEntries: sort giảm dần basePower, rank 1-based', () => {
  const { top } = rankEntries(rows, 'u1', 10);
  assert.equal(top[0].rank, 1);
  assert.equal(top[0].basePower, 95);
  // Tie 95: Beta vs Delta → tie-break nickname A→Z → Beta trước Delta.
  assert.equal(top[0].nickname, 'Beta');
  assert.equal(top[1].nickname, 'Delta');
  assert.equal(top[2].nickname, 'Alpha'); // 80
  assert.equal(top[3].nickname, 'Gamma'); // 60
});

test('rankEntries: tie-break nickname A→Z deterministic', () => {
  const a = rankEntries(rows, 'u1', 10).top.map((e) => e.nickname);
  const b = rankEntries([...rows].reverse(), 'u1', 10).top.map((e) => e.nickname);
  assert.deepEqual(a, b, 'thứ tự ổn định bất kể input order');
});

test('rankEntries: đánh dấu isMe đúng', () => {
  const { top } = rankEntries(rows, 'u3', 10);
  const me = top.find((e) => e.isMe);
  assert.equal(me.nickname, 'Gamma');
  assert.equal(top.filter((e) => e.isMe).length, 1);
});

test('rankEntries: KHÔNG lộ userId ra ngoài (privacy)', () => {
  const { top, me } = rankEntries(rows, 'u1', 10);
  for (const e of top) {
    assert.ok(!('userId' in e), 'entry không được chứa userId');
  }
  assert.ok(me && !('userId' in me));
});

test('rankEntries: topN cắt đúng, me vẫn tìm được khi NGOÀI topN', () => {
  // u3 (Gamma, 60) hạng chót. topN=2 → không nằm trong top.
  const { top, me } = rankEntries(rows, 'u3', 2);
  assert.equal(top.length, 2);
  assert.ok(!top.some((e) => e.nickname === 'Gamma'), 'Gamma ngoài top 2');
  assert.equal(me.nickname, 'Gamma');
  assert.equal(me.rank, 4, 'me vẫn có rank thật dù ngoài topN');
});

test('rankEntries: myUserId không có trong rows → me null', () => {
  const { me } = rankEntries(rows, 'khong-ton-tai', 10);
  assert.equal(me, null);
});

test('rankEntries: rows rỗng → top rỗng, me null', () => {
  const { top, me } = rankEntries([], 'u1', 10);
  assert.deepEqual(top, []);
  assert.equal(me, null);
});

test('rankEntries: topN <=0 → top rỗng nhưng me vẫn tính', () => {
  const { top, me } = rankEntries(rows, 'u2', 0);
  assert.deepEqual(top, []);
  assert.equal(me.rank, 1); // Beta vẫn hạng 1
});
