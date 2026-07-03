import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getHintTrap } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';

/**
 * HINT API (ROOT A) — gợi ý cấp 2 "loại trừ" mà KHÔNG lộ đáp án đúng.
 *
 * Trước đây client đọc choice_analysis thẳng từ payload generate-practice (chứa
 * is_correct → lộ đáp án). Nay choice_analysis lưu server-side; endpoint này trả
 * về ĐÚNG 1 đáp án SAI + phân tích bẫy của nó (không kèm đáp án đúng). Verify
 * quyền sở hữu + câu chưa nộp (getHintTrap). Không có analysis → 404 → client
 * fallback text chung. Việc TRỪ 20 xu do client làm (spendCoins, đã server-auth).
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`hint:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const { questionId } = await req.json();
    if (typeof questionId !== 'string' || !questionId) {
      return NextResponse.json({ error: 'questionId bắt buộc' }, { status: 400 });
    }

    const trap = await getHintTrap(questionId, user.id);
    if (!trap) {
      return NextResponse.json({ error: 'Không có gợi ý cho câu này' }, { status: 404 });
    }

    return NextResponse.json(trap);
  } catch (error) {
    console.error('Hint error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
