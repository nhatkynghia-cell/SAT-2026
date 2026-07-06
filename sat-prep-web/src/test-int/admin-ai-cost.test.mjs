/**
 * INTEGRATION — /api/admin/ai-cost (shared-secret guard).
 * Bất biến: KHÔNG secret / sai secret → 403 (fail-closed, KHÔNG lộ số liệu vận
 * hành) · đúng secret → 200 + báo cáo chi phí (ledger rỗng fail-open costUsd 0).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Route đọc process.env.ADMIN_SECRET mỗi lần verify → set TRƯỚC khi import route.
process.env.ADMIN_SECRET = 'test-admin-secret-aicost';

const { resetDb } = await import('./harness.mjs');
const { GET } = await import('@/app/api/admin/ai-cost/route.ts');

const SECRET = 'test-admin-secret-aicost';

function req({ secret } = {}) {
  const headers = {};
  if (secret !== undefined) headers['x-admin-secret'] = secret;
  return new Request('http://t/admin/ai-cost', { method: 'GET', headers });
}

async function readRes(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

test('ai-cost: GET KHÔNG secret → 403 (fail-closed, không lộ số liệu)', async () => {
  resetDb();
  const { status, body } = await readRes(await GET(req()));
  assert.equal(status, 403);
  assert.equal(body.success, false);
  // KHÔNG rò rỉ field chi phí trong response bị chặn.
  assert.equal(body.costUsd, undefined);
  assert.equal(body.budgetUsd, undefined);
});

test('ai-cost: GET sai secret → 403', async () => {
  resetDb();
  const { status } = await readRes(await GET(req({ secret: 'wrong' })));
  assert.equal(status, 403);
});

test('ai-cost: GET đúng secret → 200 + báo cáo chi phí (ledger rỗng fail-open)', async () => {
  resetDb();
  const { status, body } = await readRes(await GET(req({ secret: SECRET })));
  assert.equal(status, 200);
  // Bảng ai_cost_ledger không seed → loadLedger fail-open → emptyLedger.
  assert.equal(body.costUsd, 0, 'ledger rỗng → chi phí 0');
  assert.equal(typeof body.budgetUsd, 'number', 'có trần ngân sách');
  assert.equal(typeof body.remainingUsd, 'number', 'có phần ngân sách còn lại');
});
