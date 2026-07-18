import { createClient } from '@/lib/supabase/server';
import { isE2E, E2E_USER_ID } from '@/lib/e2e';

/**
 * ============================================================================
 *  AUTH ABSTRACTION — ĐIỂM SWAP DUY NHẤT (single swap point)
 * ============================================================================
 *  Mục tiêu (implementation_plan.md §9.3, task #1): mọi API route nhận biết
 *  "người dùng hiện tại" NGAY TỪ ĐẦU, kể cả khi chưa có Supabase.
 *
 *  Khi tích hợp Supabase Auth thật, CHỈ cần sửa thân hàm getCurrentUser()
 *  bên dưới (đọc session từ Supabase thay vì cookie stub). Toàn bộ các route
 *  và helper user-data KHÔNG phải đụng lại.
 * ============================================================================
 */

/** User mặc định khi chưa đăng nhập (chế độ local/stub). */
export const DEFAULT_USER_ID = 'local-default-user';

/** Tên cookie giữ user id ở bản stub. Supabase sau này dùng cookie session riêng. */
export const USER_COOKIE = 'sat_user_id';

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
