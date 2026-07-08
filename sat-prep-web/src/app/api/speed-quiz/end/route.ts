import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { finalizeSession, claimMilestones } from '@/lib/speed-quiz-store';

/**
 * SPEED QUIZ END API — chốt lượt + trao thưởng theo mốc (idempotent).
 *
 * POST { sessionId } → { correctCount, rewardCoins, claims, available }.
 *   🔴 CHỐNG GIAN LẬN: correctCount do finalize RPC ĐẾM câu was_correct=true
 *   (issued_questions) tag cho session — KHÔNG lấy từ body client. Thưởng mốc
 *   chỉ dựa trên số này, idempotent 1 lần/ngày/mốc.
 *
 *   available:false = pre-migration (session không tạo được) → không thưởng.
 *   alreadyEnded → finalize idempotent, KHÔNG cộng thưởng lại (claim đã idempotent).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();

  const rl = rateLimit(`sq-end:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const { sessionId } = await req.json().catch(() => ({}));
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'sessionId bắt buộc' }, { status: 400 });
  }

  const finalized = await finalizeSession(sessionId, user.id);
  if (!finalized) {
    // Pre-migration / session không hợp lệ → không thưởng, không crash.
    return NextResponse.json({ correctCount: 0, rewardCoins: 0, claims: [], available: false });
  }

  // Claim mốc theo số câu đúng THẬT (server đếm). claimMilestones idempotent nên
  // dù finalize alreadyEnded (client gọi lại) cũng không cộng trùng.
  const claim = await claimMilestones(user.id, finalized.dayKey, finalized.correctCount);

  return NextResponse.json({
    correctCount: finalized.correctCount,
    rewardCoins: claim.totalCoins,
    claims: claim.claims,
    available: claim.available,
  });
}
