import { test, expect, type BrowserContext } from '@playwright/test';

/**
 * E2E SMOKE — các trang tính năng chính render KHÔNG crash (bổ sung mock-exam).
 *
 * Chạy dưới E2E_TEST_MODE=1 (playwright.config webServer): cookie e2e_auth +
 * env → middleware cho qua như đã đăng nhập. User E2E KHÔNG phải UUID thật nên
 * các query Supabase fail-safe (trả rỗng) — vì vậy smoke test chỉ khẳng định
 * TRANG RENDER đúng cấu trúc, KHÔNG assert dữ liệu động từ DB.
 */

async function loginE2E(context: BrowserContext) {
  await context.addCookies([{ name: 'e2e_auth', value: '1', url: 'http://localhost:3000' }]);
}

test('trang chủ render + khối "Kế hoạch hôm nay" (RPG 60/40 north star)', async ({ page, context }) => {
  await loginE2E(context);
  await page.goto('/');
  // Header ôn luyện + khối kế hoạch hôm nay (section mới).
  await expect(page.getByRole('heading', { name: /ÔN LUYỆN HẰNG NGÀY/i })).toBeVisible();
  await expect(page.getByText('Kế hoạch hôm nay').first()).toBeVisible();
});

test('trang nâng cấp: bảng so sánh 3 cột Free / Premium / Ultimate + tab kỳ', async ({ page, context }) => {
  await loginE2E(context);
  await page.goto('/upgrade');

  await expect(page.getByRole('heading', { name: /NÂNG CẤP GÓI VIP/i })).toBeVisible();
  // Chọn kỳ thanh toán (tab mới).
  await expect(page.getByText('Kỳ thanh toán:')).toBeVisible();
  // 3 cột tiêu đề.
  await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ultimate', exact: true })).toBeVisible();
  // Nhãn "Khuyên dùng" trên Premium (exact:true để KHÔNG trúng note cổng
  // "payOS — khuyên dùng (VN)") + nhóm tính năng.
  await expect(page.getByText('Khuyên dùng', { exact: true })).toBeVisible();
  await expect(page.getByText(/Học tập cốt lõi/)).toBeVisible();
  // Cột Free có nút "Gói hiện tại" (không mua được).
  await expect(page.getByRole('button', { name: 'Gói hiện tại' })).toBeVisible();
});

test('trang nâng cấp: đổi kỳ thanh toán cập nhật nhãn tiết kiệm', async ({ page, context }) => {
  await loginE2E(context);
  await page.goto('/upgrade');

  // Bấm tab "Tháng" → không còn nhãn tiết kiệm (monthly = null).
  await page.getByRole('button', { name: /^Tháng/ }).click();
  // Bấm tab "Năm" → hiện "Tiết kiệm ~33%".
  await page.getByRole('button', { name: /^Năm/ }).click();
  await expect(page.getByText('Tiết kiệm ~33%').first()).toBeVisible();
});

test('trang phụ huynh: mã KHÔNG hợp lệ → báo lỗi thân thiện, không crash', async ({ page }) => {
  // /parent là public (không cần cookie). Mã sai định dạng → thông báo, không trắng trang.
  await page.goto('/parent?code=SAI-MA-KHONG-HOP-LE');
  await expect(page.getByText(/không hợp lệ|không tồn tại|hết hạn/i).first()).toBeVisible();
});

test('dashboard render không crash (empty state hoặc bảng điểm)', async ({ page, context }) => {
  await loginE2E(context);
  await page.goto('/dashboard');
  // User E2E không có dữ liệu thật → empty state; miễn là trang tiêu đề hiện, không crash.
  await expect(page.getByRole('heading', { name: /NHẬT KÝ TRƯỞNG THÀNH/i })).toBeVisible();
});
