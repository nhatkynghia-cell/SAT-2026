import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadOwnSnapshots, todayVN } from '@/lib/daily-snapshot-store';
import { computeWeeklyTrend } from '@/lib/daily-snapshot';

/**
 * WEEKLY TREND (của CHÍNH học sinh) — cho panel xu hướng tuần ở /dashboard.
 * Đọc snapshot của mình qua RLS (loadOwnSnapshots), tính trend 7 ngày.
 * Chưa có snapshot → trend rỗng (UI báo "cần vài ngày học").
 */
export async function GET() {
  const user = await getCurrentUser();

  const today = todayVN();
  const since = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 6);
    return dt.toISOString().slice(0, 10);
  })();

  const snapshots = await loadOwnSnapshots(user.id, since);
  const trend = computeWeeklyTrend(snapshots, today);
  return NextResponse.json(trend);
}
