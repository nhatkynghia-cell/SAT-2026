/**
 * INTEGRATION — quota AI RESERVE-BEFORE-CALL (đóng C1 TOCTOU, backlog #8).
 * Bất biến chi phí: reserve tăng count NGUYÊN TỬ TRƯỚC khi gọi OpenAI → N reserve
 * đồng thời không cùng vượt cap · lỗi OpenAI → release hoàn slot (không phạt quota
 * người dùng vì lỗi hạ tầng) · thành công → finalize chỉ cộng token (count đã reserve)
 * · pre-migration (RPC chưa có) → fallback checkQuota + recordUsage cũ (0 regression)
 * · RPC lỗi thật → fail-closed (từ chối gọi AI).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, disableRpc } from './harness.mjs';
import { reserveQuota, finalizeUsage, releaseUsage } from '@/lib/ai-quota';

const U = 'q-user';
function usageRow() {
  return getRows('user_ai_usage').find((r) => r.user_id === U);
}

test('reserve: Free chat cap 3 — reserve tuần tự đến hết cap rồi từ chối', async () => {
  resetDb(); setCurrentUser({ id: U });
  const r1 = await reserveQuota(U, 'free', 'chat');
  const r2 = await reserveQuota(U, 'free', 'chat');
  const r3 = await reserveQuota(U, 'free', 'chat');
  const r4 = await reserveQuota(U, 'free', 'chat');
  assert.deepEqual([r1.allowed, r2.allowed, r3.allowed, r4.allowed], [true, true, true, false]);
  assert.deepEqual([r1.used, r2.used, r3.used], [1, 2, 3], 'count tăng dần mỗi reserve (đóng TOCTOU)');
  assert.equal(r4.used, 3, 'reserve thứ 4 không tăng count');
  assert.equal(usageRow().chat_count, 3, 'DB chỉ ghi 3 slot dù gọi 4 lần');
  assert.equal(r1.reserved, true, 'migration có → reserve nguyên tử');
});

test('reserve: burst đồng thời KHÔNG cùng vượt cap (TOCTOU closed)', async () => {
  resetDb(); setCurrentUser({ id: U });
  // 5 reserve "song song" (single-thread test = tuần tự hóa như SELECT..FOR UPDATE).
  const results = await Promise.all(
    Array.from({ length: 5 }, () => reserveQuota(U, 'free', 'gen'))
  );
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 3, 'chỉ 3/5 reserve được cấp (đúng cap Free gen=3)');
  assert.equal(usageRow().gen_count, 3, 'DB đúng 3, không burst quá cap');
});

test('reserve → OpenAI lỗi → release hoàn slot (không phạt quota người dùng)', async () => {
  resetDb(); setCurrentUser({ id: U });
  const r = await reserveQuota(U, 'free', 'chat');
  assert.equal(r.allowed, true);
  assert.equal(usageRow().chat_count, 1, 'reserve đã tăng count');

  // Giả lập OpenAI lỗi → route gọi releaseUsage với date của reservation.
  await releaseUsage(U, 'chat', r.reserved, r.date);
  assert.equal(usageRow().chat_count, 0, 'release hoàn slot về 0');

  // Sau release, user vẫn còn đủ 3 lượt.
  const again = await reserveQuota(U, 'free', 'chat');
  assert.equal(again.allowed, true);
  assert.equal(again.used, 1);
});

test('reserve → thành công → finalize chỉ cộng token, KHÔNG tăng count lần nữa', async () => {
  resetDb(); setCurrentUser({ id: U });
  const r = await reserveQuota(U, 'free', 'gen');
  assert.equal(usageRow().gen_count, 1);

  await finalizeUsage(U, 'gen', 120, 340, r.reserved, r.date);
  assert.equal(usageRow().gen_count, 1, 'count VẪN 1 (không double-count)');
  assert.equal(usageRow().tokens_in, 120);
  assert.equal(usageRow().tokens_out, 340);
});

// 🔴 REGRESSION cross-midnight (adversarial review wf_a8d34d61): release phải nhắm
// ĐÚNG ngày của RESERVATION, KHÔNG phải today() lúc release. Kịch bản: req A reserve
// cuối ngày D (date=D), req B reserve đầu ngày D+1 (reset row → date=D+1, count=1);
// A lỗi → release với r.date=D → guard `date=p_date` KHÔNG khớp (row đã là D+1) →
// no-op → KHÔNG xóa slot hợp lệ ngày mới của B. Nếu release dùng today()=D+1 → sẽ
// trừ nhầm về 0 → user được 1 lượt lố.
test('release cross-midnight: refund theo date reservation → KHÔNG xóa slot ngày mới', async () => {
  resetDb(); setCurrentUser({ id: U });
  // Req A reserve ngày cũ D (giả lập bằng seed row date=D, count=1 như sau reserve của A).
  seed('user_ai_usage', { user_id: U, date: '2020-01-01', gen_count: 0, chat_count: 1, tokens_in: 0, tokens_out: 0 });
  // Req B reserve NGÀY MỚI (today thật) → reset row → chat_count=1, date=today.
  const b = await reserveQuota(U, 'free', 'chat');
  assert.equal(b.allowed, true);
  assert.equal(usageRow().chat_count, 1, 'B reset ngày mới, dùng 1 slot hợp lệ');

  // A lỗi → release với DATE CŨ '2020-01-01' (date của reservation A, không phải today).
  await releaseUsage(U, 'chat', true, '2020-01-01');
  assert.equal(usageRow().chat_count, 1, 'refund ngày cũ KHÔNG khớp → no-op → slot B còn nguyên');
});


test('reserve: tier unlimited (premium) → luôn allowed, không chặn', async () => {
  resetDb(); setCurrentUser({ id: U });
  for (let i = 0; i < 10; i++) {
    const r = await reserveQuota(U, 'premium', 'chat');
    assert.equal(r.allowed, true, `lượt ${i} vẫn allowed`);
    assert.equal(r.limit, -1);
    assert.equal(r.remaining, Infinity);
  }
});

test('pre-migration: reserve RPC chưa có → fallback checkQuota (reserved:false), finalize=recordUsage cũ', async () => {
  resetDb(); setCurrentUser({ id: U });
  disableRpc('reserve_ai_usage');
  disableRpc('increment_ai_usage'); // ép finalize cũng đi đường load-modify-save

  const r = await reserveQuota(U, 'free', 'chat');
  assert.equal(r.reserved, false, 'pre-migration → không reserve nguyên tử');
  assert.equal(r.allowed, true, 'checkQuota đọc-thuần: chưa dùng gì → allowed');
  assert.equal(usageRow(), undefined, 'reserve read-only: CHƯA ghi count (giữ hành vi cũ)');

  // finalize (reserved:false) → recordUsage cũ tăng count + token.
  await finalizeUsage(U, 'chat', 50, 60, r.reserved, r.date);
  assert.equal(usageRow().chat_count, 1, 'record cũ tăng count sau khi gọi');
  assert.equal(usageRow().tokens_in, 50);

  // release (reserved:false) → no-op (đường cũ chưa tăng count).
  await releaseUsage(U, 'chat', r.reserved, r.date);
  assert.equal(usageRow().chat_count, 1, 'release legacy là no-op');
});
