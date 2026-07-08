import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { startSession } from '@/lib/speed-quiz-store';

/**
 * SPEED QUIZ START API — mở 1 lượt chơi, tạo session server-side.
 *
 * POST → { sessionId, available }.
 *   • available:false = pre-migration (bảng chưa có) → client vẫn CHƠI được nhưng
 *     KHÔNG có thưởng mốc / xếp hạng (fail-safe, không mở faucet).
 *   • sessionId dùng để tag câu (chống gian lận đếm) + finalize lúc kết thúc.
 */
export async function POST() {
  const user = await getCurrentUser();

  const rl = rateLimit(`sq-start:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều lượt. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const sessionId = await startSession(user.id);
  return NextResponse.json({ sessionId, available: sessionId !== null });
}
