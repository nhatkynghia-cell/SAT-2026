import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_CATALOG,
  computeUnlockedBadges,
  resolveStreakOnWrong,
  rolloverDailyQuests,
  resolveBuy,
  EQUIPMENT_POWER,
} from './rpg-rules.ts';

// ── BADGE ───────────────────────────────────────────────────────────────────

test('BADGE_CATALOG: mọi ID DUY NHẤT (không còn trùng-khác-nghĩa c_1)', () => {
  const ids = BADGE_CATALOG.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'có ID badge trùng');
});

test('BADGE_CATALOG: mọi badge đều có hàm check (không còn thẻ ma vô-điều-kiện)', () => {
  for (const b of BADGE_CATALOG) {
    assert.equal(typeof b.check, 'function', `badge ${b.id} thiếu check`);
  }
});

test('computeUnlockedBadges: user mới (level 1, 100 xu, 50 power) → chưa mở gì', () => {
  const unlocked = computeUnlockedBadges({ level: 1, maxPower: 50, coins: 100 });
  assert.deepEqual(unlocked, []);
});

test('computeUnlockedBadges: đạt 500 xu thắp ĐÚNG c_1 (Phú Hộ), KHÔNG thắp nhầm thẻ khác', () => {
  const unlocked = computeUnlockedBadges({ level: 1, maxPower: 50, coins: 500 });
  assert.ok(unlocked.includes('c_1'), 'c_1 phải mở khi đạt 500 xu');
  const c1 = BADGE_CATALOG.find((b) => b.id === 'c_1');
  assert.match(c1.title, /Phú Hộ/, 'c_1 phải là badge XU, không phải badge Boss');
});

test('computeUnlockedBadges: ngưỡng dẫn xuất đúng theo level/power/coins', () => {
  const unlocked = computeUnlockedBadges({ level: 4, maxPower: 300, coins: 2000 });
  assert.ok(unlocked.includes('b_1')); // level>=2
  assert.ok(unlocked.includes('b_2')); // level>=4
  assert.ok(!unlocked.includes('b_3')); // level>=7 chưa đạt
  assert.ok(unlocked.includes('l_1')); // power>=100
  assert.ok(unlocked.includes('l_2')); // power>=250
  assert.ok(!unlocked.includes('l_3')); // power>=500 chưa đạt
  assert.ok(unlocked.includes('c_1')); // coins>=500
  assert.ok(unlocked.includes('c_2')); // coins>=2000
  assert.ok(!unlocked.includes('c_3')); // coins>=5000 chưa đạt
});

// ── STREAK / SHIELD ──────────────────────────────────────────────────────────

test('resolveStreakOnWrong: có khiên → tiêu 1, GIỮ chuỗi', () => {
  const r = resolveStreakOnWrong(7, 2);
  assert.deepEqual(r, { streak: 7, shield: 1, shieldUsed: true });
});

test('resolveStreakOnWrong: hết khiên → chuỗi về 0', () => {
  const r = resolveStreakOnWrong(7, 0);
  assert.deepEqual(r, { streak: 0, shield: 0, shieldUsed: false });
});

test('resolveStreakOnWrong: khiên âm/rác → coi như 0, reset chuỗi', () => {
  const r = resolveStreakOnWrong(5, -3);
  assert.deepEqual(r, { streak: 0, shield: 0, shieldUsed: false });
});

test('resolveStreakOnWrong: tiêu khiên cuối → lần sau hết khiên reset', () => {
  const first = resolveStreakOnWrong(4, 1);
  assert.deepEqual(first, { streak: 4, shield: 0, shieldUsed: true });
  const second = resolveStreakOnWrong(first.streak, first.shield);
  assert.deepEqual(second, { streak: 0, shield: 0, shieldUsed: false });
});

// ── DAILY QUEST ROLLOVER ──────────────────────────────────────────────────────

const sampleDaily = [
  { id: 'q1', name: 'A', progress: 5, target: 5, claimed: true, xp: 50, coins: 10 },
  { id: 'q2', name: 'B', progress: 3, target: 10, claimed: false, xp: 100, coins: 20 },
];

test('rolloverDailyQuests: cùng ngày → không đổi (identity, changed=false)', () => {
  const r = rolloverDailyQuests(sampleDaily, '2026-07-08', '2026-07-08');
  assert.equal(r.changed, false);
  assert.equal(r.daily, sampleDaily);
});

test('rolloverDailyQuests: ngày mới → reset progress 0 + claimed false, GIỮ meta', () => {
  const r = rolloverDailyQuests(sampleDaily, '2026-07-07', '2026-07-08');
  assert.equal(r.changed, true);
  assert.equal(r.daily[0].progress, 0);
  assert.equal(r.daily[0].claimed, false);
  assert.equal(r.daily[0].target, 5); // meta giữ nguyên
  assert.equal(r.daily[0].xp, 50);
  assert.equal(r.daily[1].progress, 0);
  assert.equal(r.daily[1].claimed, false);
});

test('rolloverDailyQuests: savedDate null (dữ liệu cũ chưa có dấu ngày) → reset', () => {
  const r = rolloverDailyQuests(sampleDaily, null, '2026-07-08');
  assert.equal(r.changed, true);
  assert.equal(r.daily[0].progress, 0);
});

// ── SHOP / EQUIPMENT ──────────────────────────────────────────────────────────

test('resolveBuy: không đủ xu → từ chối', () => {
  const r = resolveBuy({ id: 'eq_leg_1', type: 'equipment', price: 5000 }, 100, []);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'insufficient');
});

test('resolveBuy: equipment huyền thoại → cộng maxPower THẬT (đồ không còn chết)', () => {
  const r = resolveBuy({ id: 'eq_leg_1', type: 'equipment', price: 5000 }, 6000, []);
  assert.equal(r.ok, true);
  assert.equal(r.maxPowerDelta, EQUIPMENT_POWER.eq_leg_1);
  assert.ok(r.maxPowerDelta > 0);
});

test('resolveBuy: mua lại equipment đã sở hữu → CHẶN (chống bơm maxPower ảo)', () => {
  const r = resolveBuy({ id: 'eq_leg_1', type: 'equipment', price: 5000 }, 6000, ['eq_leg_1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already_owned');
});

test('resolveBuy: skin đã sở hữu → cũng chặn mua trùng', () => {
  const r = resolveBuy({ id: 'skin_1', type: 'skin', price: 1500 }, 3000, ['skin_1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already_owned');
});

test('resolveBuy: consumable Khiên → mua LẶP được + shieldDelta 1', () => {
  const r = resolveBuy({ id: 'shield_1', type: 'consumable', price: 50 }, 500, ['shield_1']);
  assert.equal(r.ok, true, 'consumable phải mua lặp được dù đã có');
  assert.equal(r.shieldDelta, 1);
  assert.equal(r.maxPowerDelta, 0);
});

test('resolveBuy: skin thường → mua được, 0 maxPower (thuần thẩm mỹ)', () => {
  const r = resolveBuy({ id: 'skin_1', type: 'skin', price: 1500 }, 3000, []);
  assert.equal(r.ok, true);
  assert.equal(r.maxPowerDelta, 0);
});
