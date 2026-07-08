import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST_POOL,
  QUEST_REWARD_MAP,
  pickDailyQuests,
  resolveDailyQuests,
} from './quests.ts';

// ── pickDailyQuests: deterministic + xoay vòng ──────────────────────────────

test('pickDailyQuests: luôn trả 3 quest, mỗi track 1 cái', () => {
  const q = pickDailyQuests('2026-07-09');
  assert.equal(q.length, 3);
  assert.deepEqual(q.map((x) => x.track), ['answer', 'vocab', 'exam']);
});

test('pickDailyQuests: DETERMINISTIC — cùng ngày → cùng bộ', () => {
  const a = pickDailyQuests('2026-07-09');
  const b = pickDailyQuests('2026-07-09');
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
});

test('pickDailyQuests: XOAY VÒNG — vài ngày khác nhau cho ra ít nhất 2 bộ khác', () => {
  const ids = new Set<string>();
  for (const day of ['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13']) {
    ids.add(pickDailyQuests(day).map((x) => x.id).join(','));
  }
  assert.ok(ids.size >= 2, 'nhiều ngày phải sinh ít nhất 2 bộ quest khác nhau');
});

test('pickDailyQuests: progress 0 + claimed false cho bộ mới', () => {
  const q = pickDailyQuests('2026-07-09');
  for (const x of q) {
    assert.equal(x.progress, 0);
    assert.equal(x.claimed, false);
  }
});

test('pickDailyQuests: id chọn ra luôn thuộc pool của track tương ứng', () => {
  const q = pickDailyQuests('2026-07-09');
  for (const x of q) {
    const poolIds = QUEST_POOL[x.track].map((v) => v.id);
    assert.ok(poolIds.includes(x.id), `${x.id} phải thuộc pool ${x.track}`);
  }
});

// ── resolveDailyQuests: giữ/đổi theo ngày ────────────────────────────────────

test('resolveDailyQuests: cùng ngày → GIỮ nguyên (bảo toàn progress/claimed)', () => {
  const saved = [{ id: 'q1', progress: 3, claimed: false }];
  const r = resolveDailyQuests(saved, '2026-07-09', '2026-07-09');
  assert.equal(r.changed, false);
  assert.deepEqual(r.daily, saved);
});

test('resolveDailyQuests: ngày mới → bộ MỚI (progress reset)', () => {
  const saved = [{ id: 'q1', progress: 5, claimed: true }];
  const r = resolveDailyQuests(saved, '2026-07-08', '2026-07-09');
  assert.equal(r.changed, true);
  assert.equal(r.daily.length, 3);
  assert.ok(r.daily.every((q) => q.progress === 0));
});

test('resolveDailyQuests: savedDate null (dữ liệu cũ) → bộ mới', () => {
  const r = resolveDailyQuests([], null, '2026-07-09');
  assert.equal(r.changed, true);
  assert.equal(r.daily.length, 3);
});

test('resolveDailyQuests: cùng ngày nhưng daily rỗng → vẫn sinh bộ mới', () => {
  const r = resolveDailyQuests([], '2026-07-09', '2026-07-09');
  assert.equal(r.changed, true);
  assert.equal(r.daily.length, 3);
});

// ── QUEST_REWARD_MAP: dẫn xuất đầy đủ + tương thích ngược ─────────────────────

test('QUEST_REWARD_MAP: phủ MỌI biến thể trong pool', () => {
  const allIds = (['answer', 'vocab', 'exam'] as const).flatMap((t) => QUEST_POOL[t].map((v) => v.id));
  for (const id of allIds) {
    assert.ok(QUEST_REWARD_MAP[id], `reward map phải có ${id}`);
    assert.ok(QUEST_REWARD_MAP[id].coins > 0);
    assert.ok(QUEST_REWARD_MAP[id].xp > 0);
  }
});

test('QUEST_REWARD_MAP: giữ q1/q2/q3 (tương thích ngược money-path)', () => {
  assert.deepEqual(QUEST_REWARD_MAP.q1, { coins: 10, xp: 50 });
  assert.deepEqual(QUEST_REWARD_MAP.q2, { coins: 20, xp: 100 });
  assert.deepEqual(QUEST_REWARD_MAP.q3, { coins: 100, xp: 500 });
});

test('QUEST_REWARD_MAP: cùng track → reward ĐỒNG NHẤT (xoay vòng không lệch cày cuốc)', () => {
  for (const track of ['answer', 'vocab', 'exam'] as const) {
    const rewards = QUEST_POOL[track].map((v) => `${v.coins}:${v.xp}`);
    assert.equal(new Set(rewards).size, 1, `mọi biến thể track ${track} phải cùng reward`);
  }
});
