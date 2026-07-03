import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { recordAnswer, getMasterySummary, type Difficulty } from '@/lib/mastery';
import { isValidSkill } from '@/lib/skill-taxonomy';
import { rateLimit } from '@/lib/rate-limit';

/**
 * MASTERY API (implementation_plan.md §10.A.3, task #9)
 *
 * GET  → tổng hợp mastery của user (cho dashboard, Skill Tree, score prediction).
 * POST → ghi nhận 1 câu trả lời { skillId, isCorrect, difficulty } và trả về
 *        mastery mới của skill đó.
 *
 * Server-authoritative: chỉ server cập nhật điểm mastery (§9.1). Client gửi
 * SỰ KIỆN trả lời, không gửi điểm.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export async function GET() {
  const user = await getCurrentUser();
  const summary = await getMasterySummary(user.id);
  return NextResponse.json(summary);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`mastery:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const { skillId, isCorrect, difficulty } = await req.json();

    if (typeof skillId !== 'string' || !isValidSkill(skillId)) {
      return NextResponse.json({ error: 'skillId không hợp lệ' }, { status: 400 });
    }
    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect phải là boolean' }, { status: 400 });
    }

    const diff: Difficulty = VALID_DIFFICULTY.includes(difficulty) ? difficulty : 'Medium';

    const updated = await recordAnswer(user.id, skillId, isCorrect, diff);
    return NextResponse.json({ success: true, skillId, mastery: updated });
  } catch (error) {
    console.error('Lỗi ghi mastery:', error);
    return NextResponse.json({ error: 'Failed to record mastery' }, { status: 500 });
  }
}
