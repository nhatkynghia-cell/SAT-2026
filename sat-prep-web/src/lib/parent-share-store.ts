import { createAdminClient } from '@/lib/supabase/admin';
import { generateShareCode, isCodeUsable, type ShareCodeRow } from './parent-share';

/**
 * PARENT SHARE STORE — I/O bảng parent_share_codes.
 * Sinh mã + resolve cross-user CHỈ qua service-role (RLS chỉ cho student
 * SELECT/UPDATE own). FAIL-SAFE: bảng chưa có / lỗi → trả [] / null.
 */

/** Sinh + lưu 1 mã mới cho học sinh. Trả mã, hoặc null nếu ghi lỗi. */
export async function createShareCode(studentId: string, ttlDays?: number): Promise<string | null> {
  const admin = createAdminClient();
  const code = generateShareCode();
  const expires_at =
    typeof ttlDays === 'number' && ttlDays > 0
      ? new Date(Date.now() + ttlDays * 86400_000).toISOString()
      : null;

  const { error } = await admin
    .from('parent_share_codes')
    .insert({ code, student_user_id: studentId, revoked: false, expires_at });

  if (error) {
    console.error('createShareCode: lỗi ghi:', error.message);
    return null;
  }
  return code;
}

/** Danh sách mã của 1 học sinh (mới nhất trước). */
export async function listShareCodes(studentId: string): Promise<ShareCodeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('parent_share_codes')
    .select('code, student_user_id, revoked, expires_at')
    .eq('student_user_id', studentId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as ShareCodeRow[];
}

/** Thu hồi 1 mã — CHỈ khi thuộc về học sinh đó (verify ownership). */
export async function revokeShareCode(studentId: string, code: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('parent_share_codes')
    .update({ revoked: true })
    .eq('code', code)
    .eq('student_user_id', studentId);

  if (error) {
    console.error('revokeShareCode: lỗi:', error.message);
    return false;
  }
  return true;
}

/**
 * Tra mã (phụ huynh nhập) → student_user_id nếu mã CÒN DÙNG ĐƯỢC, ngược lại null.
 * Cross-user đọc qua service-role (phụ huynh không có auth session).
 */
export async function resolveShareCode(code: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('parent_share_codes')
    .select('code, student_user_id, revoked, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ShareCodeRow;
  if (!isCodeUsable(row, Date.now())) return null;
  return row.student_user_id;
}
