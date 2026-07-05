/**
 * INTEGRATION — /api/migrate-data (công cụ legacy migrate 1-lần, ĐÃ KHOÁ 2026-07-05).
 * Route từng là vector bơm số dư (GET + không auth + ghi đè coins/xp từ file JSON).
 * Test khoá 2 chốt bảo mật deterministic (chạy TRƯỚC mọi file-access):
 *   • CHỐT 1: mặc định TẮT (không set ENABLE_LEGACY_MIGRATION) → 410, KHÔNG ghi gì.
 *   • CHỐT 2: bật nhưng chưa đăng nhập → 401, KHÔNG ghi gì.
 * (CHỐT 4 no-overwrite cần file streak_data.json legacy hiện diện — không seed file
 *  giả trong test; đã verify logic qua đọc route + tsc. Prod: file gitignored.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, getRows, readRes } from './harness.mjs';
import { GET } from '@/app/api/migrate-data/route';

function reqGet() {
  return undefined; // route GET() không nhận tham số
}

test('migrate-data: mặc định TẮT (không có env) → 410 MIGRATION_DISABLED, KHÔNG ghi economy', async () => {
  resetDb();
  setCurrentUser({ id: 'mig-user' });
  delete process.env.ENABLE_LEGACY_MIGRATION;
  const { status, body } = await readRes(await GET(reqGet()));
  assert.equal(status, 410);
  assert.equal(body.code, 'MIGRATION_DISABLED');
  assert.equal(getRows('user_economy').length, 0, 'route chết trước mọi ghi');
});

test('migrate-data: bật env nhưng CHƯA đăng nhập → 401, KHÔNG ghi economy', async () => {
  resetDb();
  setCurrentUser(null); // getCurrentUser → isAuthenticated:false
  process.env.ENABLE_LEGACY_MIGRATION = 'true';
  try {
    const { status } = await readRes(await GET(reqGet()));
    assert.equal(status, 401);
    assert.equal(getRows('user_economy').length, 0, 'chưa auth → không ghi');
  } finally {
    delete process.env.ENABLE_LEGACY_MIGRATION; // dọn env cho test khác
  }
});

// LƯU Ý: KHÔNG test đường "đã qua 2 chốt → đọc file" ở đây vì phụ thuộc file legacy
// (../10.SAT_Prep_App - Copy/streak_data.json) có mặt hay không → non-deterministic
// giữa máy dev (có file) và CI (gitignored). Chốt 4 NO-OVERWRITE đã verify qua đọc
// route + tsc. 2 chốt chặn chính (410 mặc-định-tắt, 401 auth) là điều cốt lõi + đã pin.
