import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REWARDS, getReward } from './rewards.ts';

test('REWARDS: 3 quà thật, mỗi quà cost > 0 và id khớp key', () => {
  const ids = Object.keys(REWARDS);
  assert.deepEqual(ids.sort(), ['rw_1', 'rw_2', 'rw_3']);
  for (const [key, r] of Object.entries(REWARDS)) {
    assert.equal(r.id, key, `id phải khớp key (${key})`);
    assert.ok(Number.isInteger(r.cost) && r.cost > 0, `${key} cost phải là số nguyên > 0`);
    assert.ok(r.name.length > 0, `${key} phải có tên`);
    assert.ok(['voucher', 'material', 'ai_perk'].includes(r.kind), `${key} kind hợp lệ`);
  }
});

test('REWARDS: giá khớp với ITEM_CATALOG (chốt chống lệch giá client/server)', () => {
  // Giá server (rewards.ts) PHẢI khớp price hiển thị ở ITEM_CATALOG. Nếu ai đổi
  // 1 chỗ mà quên chỗ kia, test này gãy — buộc đồng bộ.
  assert.equal(REWARDS.rw_1.cost, 50000);
  assert.equal(REWARDS.rw_2.cost, 10000);
  assert.equal(REWARDS.rw_3.cost, 20000);
});

test('getReward: tra đúng quà; rewardId lạ → undefined (chống forge)', () => {
  assert.equal(getReward('rw_1')?.cost, 50000);
  assert.equal(getReward('rw_3')?.kind, 'ai_perk');
  assert.equal(getReward('rw_999'), undefined);
  assert.equal(getReward(''), undefined);
  // item ẢO (không phải reward) KHÔNG có trong danh mục đổi quà thật
  assert.equal(getReward('skin_1'), undefined);
  assert.equal(getReward('shield_1'), undefined);
});
