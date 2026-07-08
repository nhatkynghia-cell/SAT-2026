import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { buildSpeedQuizLeaderboard } from '@/lib/speed-quiz-leaderboard-store';
import type { SeasonCycle } from '@/lib/season';

/**
 * SPEED QUIZ LEADERBOARD API (đọc-only) — xếp hạng theo LƯỢT TỐT NHẤT trong kỳ.
 *
 * GET ?cycle=day|week|month|year → { cycle, cycleKey, cycleLabel, msLeft, top, me, available }.
 *   • Metric = MAX(correct_count) mỗi user trong kỳ (server chấm → không fake).
 *   • Chỉ user OPT-IN mới lên bảng (tái dùng opt_in_leaderboard của user_profiles).
 *   • available:false = bảng chưa migrate → UI "sắp ra mắt".
 *
 * 🔴 PRIVACY: response CHỈ nickname + score + rank + isMe. KHÔNG user_id/email.
 */

const TOP_N = 50;
const VALID_CYCLES: SeasonCycle[] = ['day', 'week', 'month', 'year'];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const rl = rateLimit(`sq-lb:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const cycleParam = request.nextUrl.searchParams.get('cycle') ?? 'day';
  if (!VALID_CYCLES.includes(cycleParam as SeasonCycle)) {
    return NextResponse.json({ error: 'cycle phải là day|week|month|year' }, { status: 400 });
  }

  try {
    const view = await buildSpeedQuizLeaderboard(user.id, cycleParam as SeasonCycle, TOP_N);
    return NextResponse.json(view);
  } catch (error) {
    console.error('Lỗi speed-quiz leaderboard:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
