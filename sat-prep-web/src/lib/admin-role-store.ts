import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ============================================================================
 *  ADMIN ROLE STORE — kiểm tài khoản có role 'admin' (bảng user_roles)
 * ============================================================================
 *  Phần role-based của dual-auth admin (xem migration_admin_roles.sql). Đọc
 *  cross-user qua service-role (RLS chỉ cho user đọc dòng mình; server cần đọc
 *  bất kỳ userId nào để gate route).
 *
 *  🔴 FAIL-CLOSED: bảng chưa migrate / lỗi đọc / userId rỗng → trả FALSE (KHÔNG
 *  vô tình cấp quyền admin). Đây là quyền cao nhất → mọi bất định = từ chối.
 *  Chưa chạy migration → luôn false → chỉ đường ADMIN_SECRET hoạt động (0 regression).
 * ============================================================================
 */

/** true CHỈ khi userId có dòng role='admin' trong user_roles. Fail-closed. */
export async function isUserAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId || typeof userId !== 'string') return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (error) {
      // 42P01 = undefined_table (chưa migrate) / PGRST205 → fail-closed (false).
      // Lỗi khác cũng fail-closed: quyền admin không được cấp khi bất định.
      return false;
    }
    return !!data;
  } catch {
    return false;
  }
}
