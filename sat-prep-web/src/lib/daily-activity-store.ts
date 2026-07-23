import { createAdminClient } from '@/lib/supabase/admin';
import { todayVN } from './daily-snapshot-store';

/**
 * ============================================================================
 *  DAILY ACTIVITY COUNTER — đếm hoạt động học theo NGÀY VN (quest learning-contract)
 * ============================================================================
 *  Quest 'vocab-reviewed' / 'exam-completed' cần đối chiếu SỰ KIỆN HỌC THẬT
 *  server-side (như 'answer-correct' dùng issued_questions). Nhưng ôn từ vựng
 *  (vocab JSONB) và nộp bài thi KHÔNG ghi log per-event theo ngày → không đếm
 *  được. Bảng này là counter (user_id, activity_date, kind) → count, tăng
 *  ATOMIC qua RPC bump_daily_activity.
 *
 *  🔴 KHÔNG đụng coins/xp — chỉ đếm hoạt động. Route tiền (vocab/exam) tăng đếm
 *  FIRE-AND-FORGET (không chặn/không fail đường thưởng). Quest route đọc để gate.
 *
 *  FAIL-SAFE hai chiều:
 *   • bump lỗi/pre-migration → nuốt (không vỡ money-path).
 *   • count lỗi/pre-migration → trả NULL (KHÔNG phải 0) → quest route coi là
 *     "không đo được" → FAIL-OPEN (giữ hành vi cũ, 0 regression). Trả 0 sẽ
 *     BLOCK nhầm quest khi bảng chưa có → sai.
 * ============================================================================
 */

export type ActivityKind = 'vocab_review' | 'exam_complete';

/**
 * Tăng counter hoạt động hôm nay (VN) lên `delta` (mặc định 1). Fire-and-forget:
 * nuốt MỌI lỗi (pre-migration / bảng lỗi) để KHÔNG chặn đường thưởng gọi nó.
 */
export async function bumpDailyActivity(
  userId: string,
  kind: ActivityKind,
  delta = 1
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('bump_daily_activity', {
      p_user_id: userId,
      p_date: todayVN(),
      p_kind: kind,
      p_delta: delta,
    });
    if (error && error.code !== '42883' && error.code !== 'PGRST202') {
      console.error('bump_daily_activity lỗi (bỏ qua):', error.message);
    }
  } catch (e) {
    console.error('bumpDailyActivity exception (bỏ qua):', e);
  }
}

/**
 * Đếm hoạt động `kind` trong ngày `day` (VN 'YYYY-MM-DD', mặc định hôm nay).
 * Trả:
 *   • number — đọc được (0 nếu chưa có hoạt động).
 *   • null   — bảng CHƯA tồn tại (pre-migration) hoặc lỗi đọc → caller FAIL-OPEN.
 */
export async function countDailyActivity(
  userId: string,
  kind: ActivityKind,
  day: string = todayVN()
): Promise<number | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_daily_activity')
      .select('count')
      .eq('user_id', userId)
      .eq('activity_date', day)
      .eq('kind', kind)
      .maybeSingle();
    if (error) {
      // 42P01 = undefined_table (bảng chưa migrate) → fail-open (null).
      if (error.code === '42P01' || error.code === 'PGRST205') return null;
      console.error('countDailyActivity lỗi (fail-open null):', error.message);
      return null;
    }
    const n = data?.count;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  } catch (e) {
    console.error('countDailyActivity exception (fail-open null):', e);
    return null;
  }
}
