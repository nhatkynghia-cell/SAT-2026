import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { predictScore, setGoal } from '@/lib/score-prediction';

/**
 * SCORE PREDICTION API (implementation_plan.md §10.A.5, task #11)
 *
 * GET  → dự đoán điểm SAT 400-1600 từ mastery + mục tiêu + skill cần tập trung.
 * POST → đặt điểm mục tiêu { targetScore } (400..1600).
 */

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(await predictScore(user.id));
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { targetScore } = await req.json();

    if (typeof targetScore !== 'number' || Number.isNaN(targetScore)) {
      return NextResponse.json({ error: 'targetScore phải là số (400..1600)' }, { status: 400 });
    }

    const goal = await setGoal(user.id, targetScore);
    return NextResponse.json({ success: true, goal, prediction: await predictScore(user.id) });
  } catch (error) {
    console.error('Lỗi đặt mục tiêu:', error);
    return NextResponse.json({ error: 'Failed to set goal' }, { status: 500 });
  }
}
