import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — HÀNH TRÌNH HỌC SINH LÀM BÀI THI (/mock-exams).
 *
 * Giả lập học sinh: vào đấu trường → bắt đầu thi → chọn đáp án (ngẫu nhiên) từng
 * câu → nộp module → đi hết 4 module adaptive (RW M1→M2→break→Math M1→M2) →
 * kiểm tra BẢNG ĐIỂM hiện ra.
 *
 * Chạy dưới E2E_TEST_MODE=1 (playwright.config webServer): auth bypass + đề TẤT
 * ĐỊNH 2 câu/module (không OpenAI, không DB). Xem src/lib/e2e.ts.
 */

const LETTERS = ['A', 'B', 'C', 'D'];

/** Chọn 1 đáp án NGẪU NHIÊN cho câu hiện tại (đáp án bắt đầu bằng "A)"/"B)"...). */
async function answerRandom(page: Page) {
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  await page.getByRole('button', { name: new RegExp(`^${letter}\\)`) }).click();
}

/** Làm hết 1 module: mỗi câu chọn đáp án rồi "Câu tiếp"; câu cuối thì "Nộp Module". */
async function completeModule(page: Page) {
  for (let guard = 0; guard < 30; guard++) {
    await answerRandom(page);
    const submitBtn = page.getByRole('button', { name: /Nộp Module/ });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      return;
    }
    await page.getByRole('button', { name: /Câu tiếp/ }).click();
  }
  throw new Error('completeModule: quá 30 câu — có thể luồng bị kẹt');
}

test('học sinh làm trọn bài thi thử → thấy bảng điểm', async ({ page, context }) => {
  // Phiên đăng nhập E2E: cookie này + E2E_TEST_MODE=1 → middleware cho qua.
  await context.addCookies([
    { name: 'e2e_auth', value: '1', url: 'http://localhost:3000' },
  ]);

  await page.goto('/mock-exams');

  // Lobby → bắt đầu thi
  await expect(page.getByRole('button', { name: 'BẮT ĐẦU THI' })).toBeVisible();
  await page.getByRole('button', { name: 'BẮT ĐẦU THI' }).click();

  // RW Module 1 → Module 2
  await expect(page.getByText(/E2E RW Module 1/)).toBeVisible();
  await completeModule(page); // RW M1
  await completeModule(page); // RW M2

  // Nghỉ giải lao → vào Math
  await expect(page.getByRole('button', { name: /VÀO PHẦN MATH/ })).toBeVisible();
  await page.getByRole('button', { name: /VÀO PHẦN MATH/ }).click();

  // Math Module 1 → Module 2
  await expect(page.getByText(/E2E MATH Module 1/)).toBeVisible();
  await completeModule(page); // Math M1
  await completeModule(page); // Math M2

  // BẢNG ĐIỂM hiện ra
  await expect(page.getByText('KẾT QUẢ THI DIGITAL SAT')).toBeVisible();
  await expect(page.getByText(/\/ 1600/)).toBeVisible();
  // Có breakdown 2 phần (exact:true để KHÔNG trúng option sidebar
  // "Reading & Writing (Đọc hiểu)" / "Math (Toán học)").
  await expect(page.getByText('Reading & Writing', { exact: true })).toBeVisible();
  await expect(page.getByText('Math', { exact: true })).toBeVisible();
});
