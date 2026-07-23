import { verifyAdminSecret } from '@/lib/admin-auth';
import { getCurrentUser } from '@/lib/auth';
import { isUserAdmin } from '@/lib/admin-role-store';

/**
 * ============================================================================
 *  ADMIN ACCESS — DUAL-AUTH (session-role HOẶC shared-secret)
 * ============================================================================
 *  Cổng vào DUY NHẤT cho route admin. Cho qua nếu THỎA 1 trong 2:
 *   (a) SESSION-ADMIN: user đăng nhập + có role 'admin' (bảng user_roles).
 *   (b) SECRET: header x-admin-secret khớp ADMIN_SECRET (đường dự phòng cũ).
 *
 *  🔴 Vì sao GIỮ secret: chống TỰ KHÓA MÌNH ra ngoài. Nếu bootstrap role sai /
 *  bảng chưa migrate / RLS lỗi → secret vẫn vào được → không mất quyền quản trị.
 *  Khi role đã ổn định, có thể gỡ secret sau (đổi 1 dòng), nhưng KHÔNG gỡ vội.
 *
 *  🔴 Thứ tự kiểm: secret TRƯỚC (thuần, đồng bộ, rẻ — không I/O) → chỉ khi
 *  KHÔNG có secret hợp lệ mới đọc DB role (async). Route tự lo rate-limit
 *  brute-force secret + phân biệt 403/429 (giữ nguyên cơ chế cũ).
 *
 *  Trả:
 *   • 'secret'  — vào bằng secret đúng.
 *   • 'session' — vào bằng session-admin.
 *   • null      — KHÔNG có quyền (route trả 403/429).
 * ============================================================================
 */
export async function verifyAdminAccess(
  req: Request
): Promise<'secret' | 'session' | null> {
  // (b) Secret trước — thuần, không I/O; secret đúng bỏ qua truy vấn DB.
  if (verifyAdminSecret(req.headers.get('x-admin-secret'))) return 'secret';

  // (a) Session-admin — chỉ chạy khi không có secret hợp lệ.
  try {
    const user = await getCurrentUser();
    if (user.isAuthenticated && (await isUserAdmin(user.id))) return 'session';
  } catch {
    // getCurrentUser/isUserAdmin đã fail-safe; catch thêm cho chắc → coi như không quyền.
  }
  return null;
}
