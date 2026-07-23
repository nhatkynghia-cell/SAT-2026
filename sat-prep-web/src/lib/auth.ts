import { createClient } from '@/lib/supabase/server';
import { isE2E, E2E_USER_ID } from '@/lib/e2e';

/**
 * ============================================================================
 *  AUTH ABSTRACTION — ĐIỂM SWAP DUY NHẤT (single swap point)
 * ============================================================================
 *  Mục tiêu (implementation_plan.md §9.3, task #1): mọi API route nhận biết
 *  "người dùng hiện tại" NGAY TỪ ĐẦU.
 *
 *  ✅ ĐÃ tích hợp Supabase Auth thật: getCurrentUser() đọc session qua
 *  supabase.auth.getUser(). Chưa login → trả { id: DEFAULT_USER_ID,
 *  isAuthenticated: false } (fail-safe, không ném) → các route tự gate 401.
 *  E2E_TEST_MODE=1 (chỉ máy test) → trả user test cố định, không gọi Supabase.
 * ============================================================================
 */

/** User mặc định khi chưa đăng nhập (getCurrentUser trả về khi Supabase chưa có session). */
export const DEFAULT_USER_ID = 'local-default-user';

/**
 * Quy tắc hợp lệ cho user id: chữ-số, gạch dưới, gạch ngang, tối đa 64 ký tự.
 * Dùng để vừa chặn dữ liệu rác, vừa an toàn khi làm tên thư mục (chống path
 * traversal ở lớp user-data).
 */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface CurrentUser {
  id: string;
  /** false = đang dùng user mặc định (chưa đăng nhập). */
  isAuthenticated: boolean;
}

/** Trả về người dùng hiện tại của request. */
export async function getCurrentUser(): Promise<CurrentUser> {
  // E2E: khi E2E_TEST_MODE=1 (chỉ máy test), trả user test cố định, KHÔNG gọi
  // Supabase. Env không set trên prod → nhánh này coi như không tồn tại. Xem src/lib/e2e.ts.
  if (isE2E()) {
    return { id: E2E_USER_ID, isAuthenticated: true };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return { id: DEFAULT_USER_ID, isAuthenticated: false };
    }

    return { id: data.user.id, isAuthenticated: true };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return { id: DEFAULT_USER_ID, isAuthenticated: false };
  }
}
