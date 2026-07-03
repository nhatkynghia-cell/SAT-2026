import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`grade:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const { questionId, answer } = await req.json();

    if (typeof questionId !== 'string' || !questionId) {
      return NextResponse.json({ error: 'questionId bắt buộc' }, { status: 400 });
    }
    if (typeof answer !== 'string' || !answer) {
      return NextResponse.json({ error: 'answer bắt buộc' }, { status: 400 });
    }

    const result = await gradeAnswer(questionId, user.id, answer);

    if (!result) {
      return NextResponse.json({ error: 'Câu hỏi không hợp lệ hoặc đã trả lời' }, { status: 404 });
    }

    return NextResponse.json({
      correct: result.correct,
      correctChoice: result.correctChoice,
      skillId: result.skillId,
      difficulty: result.difficulty,
    });
  } catch (error) {
    console.error('Grade error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
