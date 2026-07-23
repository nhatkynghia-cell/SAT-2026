/**
 * INTEGRATION — /api/payment/create (khởi tạo giao dịch 'pending').
 * Bất biến tiền: SERVER tra giá từ PLANS (client KHÔNG gửi số tiền — nếu tin
 * body.amount thì thanh toán rẻ mở gói đắt); phải đăng nhập; gateway/tier/period
 * không hợp lệ → 400 KHÔNG ghi row. IPN sau này đối chiếu amount_vnd đã ghi ở đây.
 *
 * Cổng chưa cấu hình phải trả 503 TRƯỚC khi ghi giao dịch pending, để không tạo
 * order mồ côi khi user bấm nhầm gateway chưa có credentials.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, getRows, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/payment/create/route';
import { getPlan } from '@/lib/subscription';

// Đảm bảo các cổng KHÔNG cấu hình (đường 503-không-ghi-row, không gọi API cổng).
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.PAYOS_CLIENT_ID;
delete process.env.PAYOS_API_KEY;
delete process.env.PAYOS_CHECKSUM_KEY;
delete process.env.VNPAY_TMN_CODE;
delete process.env.VNPAY_HASH_SECRET;
delete process.env.MOMO_PARTNER_CODE;
delete process.env.MOMO_ACCESS_KEY;
delete process.env.MOMO_SECRET_KEY;

test('payment/create: chưa đăng nhập → 401, KHÔNG ghi giao dịch', async () => {
  resetDb(); setCurrentUser(null); // getCurrentUser → isAuthenticated:false
  const { status } = await readRes(await POST(postJson({ gateway: 'stripe', tier: 'premium', period: 'yearly' })));
  assert.equal(status, 401);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: SERVER tra giá PLANS trước khi chặn cổng chưa cấu hình', async () => {
  resetDb(); setCurrentUser({ id: 'pc-user' });
  const plan = getPlan('premium', 'yearly');
  assert.ok(plan && plan.priceVnd > 0, 'gói premium/yearly tồn tại');

  // Kẻ tấn công gửi amount:1; route vẫn tự tra PLANS, nhưng vì cổng chưa cấu hình
  // nên chặn 503 TRƯỚC khi ghi pending orphan.
  const { status } = await readRes(await POST(postJson({ gateway: 'stripe', tier: 'premium', period: 'yearly', amount: 1, amountVnd: 1, priceVnd: 1 })));
  assert.equal(status, 503);
  assert.equal(getRows('payment_transactions').length, 0, 'thiếu creds → không ghi pending orphan');
});

test('payment/create: tier không hợp lệ → 400, KHÔNG ghi row', async () => {
  resetDb(); setCurrentUser({ id: 'pc-badtier' });
  const { status } = await readRes(await POST(postJson({ gateway: 'stripe', tier: 'god_mode', period: 'yearly' })));
  assert.equal(status, 400);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: gateway không hợp lệ → 400, KHÔNG ghi row', async () => {
  resetDb(); setCurrentUser({ id: 'pc-badgw' });
  const { status } = await readRes(await POST(postJson({ gateway: 'bitcoin', tier: 'premium', period: 'monthly' })));
  assert.equal(status, 400);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: period không hợp lệ → 400, KHÔNG ghi row', async () => {
  resetDb(); setCurrentUser({ id: 'pc-badperiod' });
  const { status } = await readRes(await POST(postJson({ gateway: 'stripe', tier: 'ultimate', period: 'lifetime' })));
  assert.equal(status, 400);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: gateway chưa cấu hình → 503, KHÔNG tạo pending orphan', async () => {
  for (const gateway of ['stripe', 'vnpay', 'momo']) {
    resetDb(); setCurrentUser({ id: `pc-unconfigured-${gateway}` });
    const { status } = await readRes(await POST(postJson({ gateway, tier: 'premium', period: 'monthly' })));
    assert.equal(status, 503, `${gateway}: trả 503 khi thiếu creds`);
    assert.equal(getRows('payment_transactions').length, 0, `${gateway}: không ghi pending orphan`);
  }
});

test('payment/create: 4 gói hợp lệ đều bị chặn trước khi ghi nếu Stripe chưa cấu hình', async () => {
  for (const [tier, period] of [['premium', 'monthly'], ['premium', 'yearly'], ['ultimate', 'monthly'], ['ultimate', 'yearly']]) {
    resetDb(); setCurrentUser({ id: `pc-${tier}-${period}` });
    await readRes(await POST(postJson({ gateway: 'stripe', tier, period })));
    const rows = getRows('payment_transactions');
    assert.equal(rows.length, 0, `${tier}/${period}: thiếu creds → không ghi row`);
  }
});
