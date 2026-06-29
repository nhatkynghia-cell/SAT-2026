import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAnswerReward,
  applySpend,
  applySpin,
  comboMultiplier,
  ANSWER_REWARD,
  DEFAULT_ECONOMY,
  SPIN_VIRTUAL_ITEMS,
  type EconomyState,
} from './economy.ts';

function fresh(): EconomyState {
  return { ...DEFAULT_ECONOMY, inventory: [] };
}

test('applyAnswerReward: trả lời SAI → không thưởng gì', () => {
  const r = applyAnswerReward(fresh(), false, 'Hard', 10);
  assert.deepEqual(r.granted, { coins: 0, xp: 0 });
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins);
});

test('applyAnswerReward: Hard đúng → thưởng theo bảng cố định server', () => {
  const r = applyAnswerReward(fresh(), true, 'Hard', 0);
  assert.equal(r.granted.coins, ANSWER_REWARD.Hard.coins);
  assert.equal(r.granted.xp, ANSWER_REWARD.Hard.xp);
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins + ANSWER_REWARD.Hard.coins);
});

test('comboMultiplier: streak >= 5 → x1.5', () => {
  assert.equal(comboMultiplier(4), 1.0);
  assert.equal(comboMultiplier(5), 1.5);
});

test('applyAnswerReward: combo áp dụng khi streak dài', () => {
  const r = applyAnswerReward(fresh(), true, 'Medium', 5);
  assert.equal(r.granted.coins, Math.floor(ANSWER_REWARD.Medium.coins * 1.5));
  assert.equal(r.granted.xp, Math.floor(ANSWER_REWARD.Medium.xp * 1.5));
});

test('applySpend: đủ xu → trừ đúng, thêm item vào túi', () => {
  const s = { ...fresh(), coins: 100 };
  const r = applySpend(s, 30, 'skin_1');
  assert.equal(r.ok, true);
  assert.equal(r.state.coins, 70);
  assert.ok(r.state.inventory.includes('skin_1'));
});

test('applySpend: KHÔNG đủ xu → từ chối, state không đổi', () => {
  const s = { ...fresh(), coins: 10 };
  const r = applySpend(s, 50);
  assert.equal(r.ok, false);
  assert.equal(r.state.coins, 10);
});

test('applySpend: số tiền không hợp lệ (âm/không nguyên) → từ chối', () => {
  assert.equal(applySpend({ ...fresh(), coins: 100 }, -5).ok, false);
  assert.equal(applySpend({ ...fresh(), coins: 100 }, 3.5).ok, false);
});

test('applySpin: đã quay hôm nay → từ chối', () => {
  const s = { ...fresh(), lastSpinDate: '2026-06-27' };
  const r = applySpin(s, '2026-06-27', () => 0.5);
  assert.equal(r.ok, false);
  assert.equal(r.result.type, 'none');
});

test('applySpin: roll < 80 → thưởng xu (đồ ảo, không quà thật)', () => {
  // rng đầu = 0.1 (roll=10 → nhánh coins), rng sau = 0 → coins = 50.
  const seq = [0.1, 0];
  let i = 0;
  const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
  assert.equal(r.ok, true);
  assert.equal(r.result.type, 'coins');
  assert.equal(r.state.lastSpinDate, '2026-06-27');
});

test('applySpin: roll cao → trúng cực phẩm, item nằm trong DANH SÁCH ẢO', () => {
  // rng đầu = 0.99 (roll=99 → nhánh epic), rng sau = 0 → item đầu danh sách.
  const seq = [0.99, 0];
  let i = 0;
  const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
  assert.equal(r.result.type, 'epic');
  assert.ok(SPIN_VIRTUAL_ITEMS.includes(r.result.itemId!), 'phải là đồ ảo');
});

test('applySpin: KHÔNG có nhánh nào trao quà thật (rw_*/voucher)', () => {
  // Quét mọi roll: không item nào có tiền tố quà thật.
  for (let roll = 0; roll < 100; roll += 1) {
    const seq = [roll / 100, 0];
    let i = 0;
    const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
    if (r.result.itemId) {
      assert.ok(!r.result.itemId.startsWith('rw_'), `loot box quà thật rò rỉ: ${r.result.itemId}`);
    }
  }
});
