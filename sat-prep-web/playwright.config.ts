import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình Playwright cho E2E (chỉ Chromium). webServer TỰ khởi động `next dev`
 * kèm E2E_TEST_MODE=1 → auth bypass + đề tất định (xem src/lib/e2e.ts), nên test
 * chạy OFFLINE, không cần Supabase/OpenAI. baseURL trỏ localhost:3000.
 *
 * KHÔNG đụng `npm test` (bộ integration node --test) — Playwright chạy riêng
 * qua `npm run e2e` / `npx playwright test`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      E2E_TEST_MODE: '1',
    },
  },
});
