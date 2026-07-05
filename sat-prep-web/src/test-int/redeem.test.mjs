/**
 * INTEGRATION — /api/redeem (xu → quà THẬT, Phase 2 Bước 3).
 * Bất biến tiền-RA: server tra GIÁ từ REWARDS (client chỉ gửi rewardId) · RPC
 * atomic trừ xu + ghi phiếu · thiếu xu → 400 · forge rewardId → 400 · RPC chưa
 * tồn tại → 503 FAIL-CLOSED (KHÔNG fallback non-atomic).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, disableRpc, seed, getRows, postJson, readRes } from './harness.mjs';
import { POST, GET } from '@/app/api/redeem/route';

function seedUser(id, coins) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}

test('redeem: đủ xu, rw_2 (10000) → 200, trừ đúng xu + tạo phiếu pending', async () => {
  resetDb(); setCurrentUser({ id: 'r-ok' }); seedUser('r-ok', 25000);
  const { status, body } = await readRes(await POST(postJson({ rewardId: 'rw_2' })));
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.coins, 15000, 'số dư mới = 25000 - 10000');
  assert.equal(body.reward.cost, 10000);

  const recs = getRows('reward_redemptions');
  assert.equal(recs.length, 1);
  assert.equal(recs[0].status, 'pending');
  assert.equal(recs[0].cost_coins, 10000);
  assert.equal(getRows('user_economy')[0].coins, 15000);
});

test('redeem: KHÔNG đủ xu → 400 INSUFFICIENT_COINS, không tạo phiếu, không trừ', async () => {
  resetDb(); setCurrentUser({ id: 'r-poor' }); seedUser('r-poor', 5000);
  const { status, body } = await readRes(await POST(postJson({ rewardId: 'rw_2' }))); // cần 10000
  assert.equal(status, 400);
  assert.equal(body.code, 'INSUFFICIENT_COINS');
  assert.equal(getRows('reward_redemptions').length, 0);
  assert.equal(getRows('user_economy')[0].coins, 5000, 'không trừ xu');
});

test('redeem: rewardId forge/không hợp lệ → 400 (chống đổi quà xịn giá rẻ)', async () => {
  resetDb(); setCurrentUser({ id: 'r-forge' }); seedUser('r-forge', 999999);
  const bad = await readRes(await POST(postJson({ rewardId: 'rw_999' })));
  assert.equal(bad.status, 400);
  const virt = await readRes(await POST(postJson({ rewardId: 'skin_1' }))); // item ẢO không phải reward
  assert.equal(virt.status, 400);
  assert.equal(getRows('reward_redemptions').length, 0);
});

test('redeem: client gửi cost giả → server phớt lờ, dùng GIÁ từ REWARDS', async () => {
  resetDb(); setCurrentUser({ id: 'r-cost' }); seedUser('r-cost', 60000);
  // rw_1 giá 50000. Kẻ tấn công gửi cost:1 → server tra REWARDS, vẫn trừ 50000.
  const { body } = await readRes(await POST(postJson({ rewardId: 'rw_1', cost: 1 })));
  assert.equal(body.reward.cost, 50000);
  assert.equal(getRows('user_economy')[0].coins, 10000, 'trừ 50000 chứ không phải 1');
});

test('redeem: RPC redeem_reward CHƯA tồn tại → 503 fail-closed, KHÔNG trừ xu', async () => {
  resetDb(); setCurrentUser({ id: 'r-nomig' }); seedUser('r-nomig', 99999);
  disableRpc('redeem_reward'); // mô phỏng SQL chưa chạy → PostgREST PGRST202
  const { status, body } = await readRes(await POST(postJson({ rewardId: 'rw_2' })));
  assert.equal(status, 503);
  assert.equal(body.code, 'REDEEM_UNAVAILABLE');
  assert.equal(getRows('reward_redemptions').length, 0);
  assert.equal(getRows('user_economy')[0].coins, 99999, 'fail-closed: không trừ xu');
});

test('redeem: user KHÔNG có economy row (no_row) → 400 INSUFFICIENT, không tạo phiếu', async () => {
  resetDb(); setCurrentUser({ id: 'r-norow' }); // KHÔNG seedUser → không có row user_economy
  const { status, body } = await readRes(await POST(postJson({ rewardId: 'rw_2' })));
  assert.equal(status, 400);
  assert.equal(body.code, 'INSUFFICIENT_COINS');
  assert.equal(getRows('reward_redemptions').length, 0);
});

test('redeem: rate-limit 10/phút — request thứ 11 → 429, KHÔNG tạo phiếu vượt trần (chống faucet)', async () => {
  resetDb(); setCurrentUser({ id: 'r-rl' });
  seedUser('r-rl', 200000); // đủ xu cho >10 lần đổi rw_2 (10000/lần)

  let last;
  for (let i = 0; i < 11; i++) {
    last = await readRes(await POST(postJson({ rewardId: 'rw_2' })));
  }
  assert.equal(last.status, 429, 'request thứ 11 trong phút bị chặn');
  // 10 request đầu thành công → đúng 10 phiếu; request 429 KHÔNG tạo thêm.
  assert.equal(getRows('reward_redemptions').length, 10, 'trần 10/phút — không vượt');
});

test('redeem GET: chỉ phiếu CỦA MÌNH, mới nhất trước (cross-user isolation + ordering)', async () => {
  resetDb();
  seedUser('r-me', 100000);
  seedUser('r-other', 100000);
  // Phiếu của người khác — KHÔNG được lọt vào danh sách của mình.
  setCurrentUser({ id: 'r-other' });
  await readRes(await POST(postJson({ rewardId: 'rw_1' })));
  // Phiếu của mình: rw_2 trước, rw_3 sau → GET phải trả rw_3 (mới nhất) trước.
  setCurrentUser({ id: 'r-me' });
  await readRes(await POST(postJson({ rewardId: 'rw_2' })));
  await readRes(await POST(postJson({ rewardId: 'rw_3' })));

  const { status, body } = await readRes(await GET());
  assert.equal(status, 200);
  assert.equal(body.redemptions.length, 2, 'chỉ 2 phiếu của mình (KHÔNG thấy phiếu r-other)');
  assert.ok(body.redemptions.every((r) => r.rewardId !== 'rw_1'), 'không rò rỉ phiếu người khác');
  assert.equal(body.redemptions[0].rewardId, 'rw_3', 'mới nhất trước');
  assert.equal(body.redemptions[1].rewardId, 'rw_2');
});
