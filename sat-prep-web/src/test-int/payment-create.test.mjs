/**
 * INTEGRATION — /api/payment/create (khởi tạo giao dịch 'pending').
 * Bất biến tiền: SERVER tra giá từ PLANS (client KHÔNG gửi số tiền — nếu tin
 * body.amount thì thanh toán rẻ mở gói đắt); phải đăng nhập; gateway/tier/period
 * không hợp lệ → 400 KHÔNG ghi row. IPN sau này đối chiếu amount_vnd đã ghi ở đây.
 *
 * Dùng đường MoMo-CHƯA-cấu-hình: createMomoPayment kiểm creds TRƯỚC (không fetch)
 * → route trả 503, nhưng createTransaction ĐÃ ghi row 'pending' với giá server →
 * soi được amount_vnd mà không cần crypto/mạng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, getRows, postJson, readRes } from './harness.mjs';
import { POST } from '@/app/api/payment/create/route';
import { getPlan } from '@/lib/subscription';

// Đảm bảo MoMo KHÔNG cấu hình (đường ghi-row-rồi-503, không fetch).
delete process.env.MOMO_PARTNER_CODE;
delete process.env.MOMO_ACCESS_KEY;
delete process.env.MOMO_SECRET_KEY;

test('payment/create: chưa đăng nhập → 401, KHÔNG ghi giao dịch', async () => {
  resetDb(); setCurrentUser(null); // getCurrentUser → isAuthenticated:false
  const { status } = await readRes(await POST(postJson({ gateway: 'momo', tier: 'premium', period: 'yearly' })));
  assert.equal(status, 401);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: SERVER tra giá PLANS — body.amount client BỊ BỎ QUA', async () => {
  resetDb(); setCurrentUser({ id: 'pc-user' });
  const plan = getPlan('premium', 'yearly');
  assert.ok(plan && plan.priceVnd > 0, 'gói premium/yearly tồn tại');

  // Kẻ tấn công gửi amount:1 hòng mua gói yearly giá 1 đồng.
  await readRes(await POST(postJson({ gateway: 'momo', tier: 'premium', period: 'yearly', amount: 1, amountVnd: 1, priceVnd: 1 })));

  const rows = getRows('payment_transactions');
  assert.equal(rows.length, 1, 'đã ghi 1 giao dịch pending');
  assert.equal(rows[0].amount_vnd, plan.priceVnd, 'giá = PLANS server, KHÔNG phải 1 đồng client gửi');
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].tier, 'premium');
  assert.equal(rows[0].user_id, 'pc-user');
});

test('payment/create: tier không hợp lệ → 400, KHÔNG ghi row', async () => {
  resetDb(); setCurrentUser({ id: 'pc-badtier' });
  const { status } = await readRes(await POST(postJson({ gateway: 'momo', tier: 'god_mode', period: 'yearly' })));
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
  const { status } = await readRes(await POST(postJson({ gateway: 'momo', tier: 'ultimate', period: 'lifetime' })));
  assert.equal(status, 400);
  assert.equal(getRows('payment_transactions').length, 0);
});

test('payment/create: 4 gói hợp lệ đều ghi đúng giá server tương ứng', async () => {
  for (const [tier, period] of [['premium', 'monthly'], ['premium', 'yearly'], ['ultimate', 'monthly'], ['ultimate', 'yearly']]) {
    resetDb(); setCurrentUser({ id: `pc-${tier}-${period}` });
    await readRes(await POST(postJson({ gateway: 'momo', tier, period })));
    const rows = getRows('payment_transactions');
    assert.equal(rows.length, 1, `${tier}/${period}: ghi 1 row`);
    assert.equal(rows[0].amount_vnd, getPlan(tier, period).priceVnd, `${tier}/${period}: giá khớp PLANS`);
  }
});
