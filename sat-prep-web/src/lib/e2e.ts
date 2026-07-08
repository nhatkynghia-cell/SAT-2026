/**
 * ============================================================================
 *  E2E TEST MODE — cổng CHỈ dùng cho Playwright end-to-end (offline, tất định)
 * ============================================================================
 *  Kích hoạt DUY NHẤT khi env `E2E_TEST_MODE=1`. Biến này KHÔNG được set trên
 *  prod/Vercel → toàn bộ nhánh test dưới đây coi như KHÔNG tồn tại (fail-closed).
 *
 *  Khi bật, cho phép:
 *   (a) middleware coi cookie `e2e_auth` là phiên đăng nhập hợp lệ (bỏ Supabase),
 *   (b) getCurrentUser trả 1 user test cố định (không gọi Supabase),
 *   (c) route exam-session trả module ĐỀ tất định (bỏ OpenAI + DB) để E2E chạy
 *       nhanh/ổn định, không phụ thuộc mạng hay quota AI.
 *
 *  ⚠️ AN TOÀN (defense-in-depth): env là công tắc tổng; middleware CÒN đòi cookie
 *  `e2e_auth`. Muốn giả mạo phải có CẢ env (chỉ có trên máy test) LẪN cookie.
 * ============================================================================
 */

/** Tên cookie đánh dấu phiên E2E (giá trị bất kỳ khác rỗng). */
export const E2E_COOKIE = 'e2e_auth';

/** User id cố định cho phiên E2E (không phải UUID thật — chỉ chạy khi isE2E()). */
export const E2E_USER_ID = 'e2e-test-user';

/** true CHỈ khi env E2E_TEST_MODE=1. Mọi nhánh test gate qua đây. */
export function isE2E(): boolean {
  return process.env.E2E_TEST_MODE === '1';
}

/**
 * 1 module đề TẤT ĐỊNH cho E2E: 2 câu, đáp án đúng LUÔN là lựa chọn bắt đầu "A)".
 * Không gọi OpenAI, không ghi DB. Đủ để drive luồng UI: chọn đáp án → nộp → điểm.
 */
export function e2eModule(section: 'rw' | 'math', moduleNum: 1 | 2) {
  const isRw = section === 'rw';
  const mk = (n: number) => ({
    id: `e2e-${section}-m${moduleNum}-q${n}`,
    questionId: `e2e-${section}-m${moduleNum}-q${n}`,
    full_passage: isRw ? `Đoạn văn mẫu E2E (${section} M${moduleNum} câu ${n}).` : '',
    practice_question: `E2E ${section.toUpperCase()} Module ${moduleNum} — Câu ${n}. Chọn đáp án A.`,
    choices: ['A) Đáp án đúng', 'B) Sai', 'C) Sai', 'D) Sai'],
  });
  return {
    name: isRw ? `Reading & Writing (Module ${moduleNum})` : `Math (Module ${moduleNum})`,
    timeMinutes: isRw ? 32 : 35,
    moduleNum,
    section,
    questions: [mk(1), mk(2)],
  };
}

/** Chấm tất định E2E: đúng = đáp án bắt đầu bằng "A". Không đụng DB. */
export function e2eGrade(answers: { answer?: string }[]): number {
  return answers.filter((a) => typeof a.answer === 'string' && a.answer.trim().startsWith('A')).length;
}

/** Economy stub tối thiểu cho E2E (client syncServerEconomy không cần DB thật). */
export const E2E_ECONOMY = { coins: 0, xp: 0, inventory: [] as string[], lastSpinDate: null };
