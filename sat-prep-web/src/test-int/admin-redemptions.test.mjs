/**
 * INTEGRATION — /api/admin/redemptions (Admin Fulfillment, shared-secret).
 * Bất biến: KHÔNG secret / sai secret → 403 (fail-closed) · GET thấy phiếu
 * pending TOÀN hệ thống (cross-user, FIFO) · fulfill pending→fulfilled idempotent
 * KHÔNG hoàn xu · cancel pending→cancelled HOÀN xu atomic + idempotent KHÔNG
 * double-refund · cancel phiếu đã fulfilled → 409 · RPC chưa có → 503 fail-closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Route đọc process.env.ADMIN_SECRET mỗi lần verify → set TRƯỚC khi import route.
process.env.ADMIN_SECRET = 'test-admin-secret-xyz';

const { resetDb, disableRpc, seed, getRows } = await import('./harness.mjs');
const { GET, POST } = await import('@/app/api/admin/redemptions/route.ts');

const SECRET = 'test-admin-secret-xyz';

function req(method, { secret, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (secret !== undefined) headers['x-admin-secret'] = secret;
  return new Request('http://t/admin', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function readRes(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

/** Seed 1 phiếu pending + economy cho chủ phiếu. */
function seedPending(id, userId, coins, cost = 10000) {
  if (!getRows('user_economy').some((r) => r.user_id === userId)) {
    seed('user_economy', { user_id: userId, coins, xp: 0, inventory: [], last_spin_date: null });
  }
  seed('reward_redemptions', {
    id, user_id: userId, reward_id: 'rw_2', reward_name: 'Bộ Tài Liệu',
    cost_coins: cost, status: 'pending',
    created_at: `2026-07-06T00:00:${String(getRows('reward_redemptions').length).padStart(2, '0')}Z`,
    fulfilled_at: null,
  });
}

test('admin: GET KHÔNG secret → 403 (fail-closed)', async () => {
  resetDb();
  const { status } = await readRes(await GET(req('GET')));
  assert.equal(status, 403);
});

test('admin: GET sai secret → 403', async () => {
  resetDb();
  const { status } = await readRes(await GET(req('GET', { secret: 'wrong' })));
  assert.equal(status, 403);
});

test('admin: GET đúng secret → 200, thấy phiếu pending TOÀN hệ thống, FIFO cũ trước', async () => {
  resetDb();
  seedPending('red-0001', 'u-a', 50000);
  seedPending('red-0002', 'u-b', 50000);
  // 1 phiếu đã fulfilled → KHÔNG lọt vào hàng đợi pending.
  seed('reward_redemptions', {
    id: 'red-done', user_id: 'u-c', reward_id: 'rw_1', reward_name: 'Voucher',
    cost_coins: 50000, status: 'fulfilled', created_at: '2026-07-06T00:00:00Z', fulfilled_at: '2026-07-06T01:00:00Z',
  });

  const { status, body } = await readRes(await GET(req('GET', { secret: SECRET })));
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.redemptions.length, 2, 'chỉ 2 phiếu pending (fulfilled bị loại)');
  // Cross-user: thấy cả u-a lẫn u-b (service-role bypass RLS).
  const users = body.redemptions.map((r) => r.userId).sort();
  assert.deepEqual(users, ['u-a', 'u-b']);
  // FIFO: red-0001 (created sớm hơn) đứng trước.
  assert.equal(body.redemptions[0].id, 'red-0001', 'cũ nhất trước');
});

test('admin: POST KHÔNG secret → 403 (không consume rate-limit)', async () => {
  resetDb();
  const { status } = await readRes(await POST(req('POST', { body: { redemptionId: 'x', action: 'fulfill' } })));
  assert.equal(status, 403);
});

test('admin: fulfill pending → 200 fulfilled, KHÔNG hoàn xu', async () => {
  resetDb();
  seedPending('red-f1', 'u-f', 5000);
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-f1', action: 'fulfill' } }))
  );
  assert.equal(status, 200);
  assert.equal(body.status, 'fulfilled');
  assert.equal(getRows('reward_redemptions')[0].status, 'fulfilled');
  assert.equal(getRows('user_economy')[0].coins, 5000, 'fulfill KHÔNG hoàn xu');
});

test('admin: fulfill phiếu đã fulfilled → idempotent (200 already, không đổi)', async () => {
  resetDb();
  seedPending('red-f2', 'u-f2', 5000);
  await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-f2', action: 'fulfill' } }));
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-f2', action: 'fulfill' } }))
  );
  assert.equal(status, 200);
  assert.equal(body.idempotent, true);
  assert.equal(body.status, 'fulfilled');
});

test('admin: cancel pending → 200 cancelled + HOÀN xu (atomic)', async () => {
  resetDb();
  seedPending('red-c1', 'u-c1', 3000, 10000); // đã tiêu 10000 → còn 3000
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-c1', action: 'cancel' } }))
  );
  assert.equal(status, 200);
  assert.equal(body.status, 'cancelled');
  assert.equal(body.coins, 13000, 'hoàn 10000 → 3000+10000');
  assert.equal(getRows('user_economy')[0].coins, 13000);
  assert.equal(getRows('reward_redemptions')[0].status, 'cancelled');
});

test('admin: cancel phiếu đã cancelled → idempotent, KHÔNG double-refund', async () => {
  resetDb();
  seedPending('red-c2', 'u-c2', 3000, 10000);
  await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-c2', action: 'cancel' } }));
  const after1 = getRows('user_economy')[0].coins; // 13000
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-c2', action: 'cancel' } }))
  );
  assert.equal(status, 200);
  assert.equal(body.idempotent, true);
  assert.equal(getRows('user_economy')[0].coins, after1, 'KHÔNG hoàn xu lần 2 (chống faucet)');
});

test('admin: cancel phiếu đã fulfilled → 409 bad_status (quà đã giao, không hoàn)', async () => {
  resetDb();
  seedPending('red-c3', 'u-c3', 3000, 10000);
  await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-c3', action: 'fulfill' } }));
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-c3', action: 'cancel' } }))
  );
  assert.equal(status, 409);
  assert.equal(body.code, 'BAD_STATUS');
  assert.equal(getRows('user_economy')[0].coins, 3000, 'KHÔNG hoàn xu cho phiếu đã giao');
});

test('admin: POST phiếu không tồn tại → 404', async () => {
  resetDb();
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'nope', action: 'fulfill' } }))
  );
  assert.equal(status, 404);
  assert.equal(body.code, 'NOT_FOUND');
});

test('admin: POST thiếu action / action lạ → 400', async () => {
  resetDb();
  seedPending('red-b1', 'u-b1', 5000);
  const bad = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-b1', action: 'delete' } }))
  );
  assert.equal(bad.status, 400);
  const noAct = await readRes(await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-b1' } })));
  assert.equal(noAct.status, 400);
});

test('admin: RPC chưa tồn tại → 503 fail-closed (KHÔNG đụng phiếu/xu)', async () => {
  resetDb();
  seedPending('red-u1', 'u-u1', 3000, 10000);
  disableRpc('cancel_redemption');
  const { status, body } = await readRes(
    await POST(req('POST', { secret: SECRET, body: { redemptionId: 'red-u1', action: 'cancel' } }))
  );
  assert.equal(status, 503);
  assert.equal(body.code, 'UNAVAILABLE');
  assert.equal(getRows('user_economy')[0].coins, 3000, 'fail-closed: không hoàn xu');
  assert.equal(getRows('reward_redemptions')[0].status, 'pending', 'phiếu giữ nguyên');
});
