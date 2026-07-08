import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { buildLeaderboard } from '@/lib/leaderboard-store';

/**
 * LEADERBOARD API (đọc-only) — bảng xếp hạng mùa hiện tại theo NĂNG LỰC HỌC THẬT.
 *
 * GET → { season, top, me, available }.
 *   • Xếp theo basePower (mastery) — anti-pay-to-win.
 *   • Chỉ user OPT-IN mới lên bảng (mặc định không).
 *   • available:false = bảng user_profiles chưa migrate → UI "sắp ra mắt".
 *
 * 🔴 PRIVACY: response CHỈ có nickname + basePower + rank + isMe. KHÔNG user_id/email.
 */

const TOP_N = 50;

export async function GET() {
  const user = await getCurrentUser();

  const rl = rateLimit(`leaderboard:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const view = await buildLeaderboard(user.id, TOP_N);
    return NextResponse.json(view);
  } catch (error) {
    console.error('Lỗi leaderboard:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
