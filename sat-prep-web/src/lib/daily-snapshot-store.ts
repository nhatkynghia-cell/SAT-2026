import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMasterySummary } from './mastery';
import { buildSnapshotFromSummary, type DailySnapshot } from './daily-snapshot';

/**
 * DAILY SNAPSHOT STORE — ghi/đọc time-series tiến độ (bảng daily_snapshots).
 * Ghi qua service-role (RLS chỉ cho SELECT own). FAIL-SAFE: bảng chưa có → bỏ
 * qua ghi (fire-and-forget) / trả [] khi đọc.
 */

/** Ngày hiện tại theo giờ VN (UTC+7), 'YYYY-MM-DD'. */
export function todayVN(): string {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}

/**
 * Ghi 1 ảnh chụp tiến độ cho HÔM NAY (VN), upsert theo (user_id, snapshot_date).
 * Gọi fire-and-forget từ /api/grade sau khi recordAnswer thành công — KHÔNG
 * throw ra ngoài (nuốt lỗi) để không ảnh hưởng đường chấm điểm.
 */
export async function recordDailySnapshot(userId: string): Promise<void> {
  try {
    const summary = await getMasterySummary(userId);
    const snap = buildSnapshotFromSummary(summary);
    const admin = createAdminClient();
    const { error } = await admin
      .from('daily_snapshots')
      .upsert(
        {
          user_id: userId,
          snapshot_date: todayVN(),
          overall: snap.overall,
          math_section: snap.math_section,
          reading_section: snap.reading_section,
          total_score: snap.total_score,
          total_attempts: snap.total_attempts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,snapshot_date' }
      );
    if (error) console.error('recordDailySnapshot: lỗi ghi (bỏ qua):', error.message);
  } catch (e) {
    console.error('recordDailySnapshot: exception (bỏ qua):', e);
  }
}

/**
 * Đọc snapshot của user từ ngày `sinceDate` (>=) tới nay. Dùng admin client để
 * phục vụ cả đường phụ huynh (đã resolve mã, không có auth session của con).
 */
export async function loadSnapshots(userId: string, sinceDate: string): Promise<DailySnapshot[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('daily_snapshots')
    .select('snapshot_date, overall, math_section, reading_section, total_score, total_attempts')
    .eq('user_id', userId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];
  return data as DailySnapshot[];
}

/** Đọc snapshot CỦA CHÍNH MÌNH (RLS SELECT own) — cho dashboard cá nhân. */
export async function loadOwnSnapshots(userId: string, sinceDate: string): Promise<DailySnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('snapshot_date, overall, math_section, reading_section, total_score, total_attempts')
    .eq('user_id', userId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];
  return data as DailySnapshot[];
}
