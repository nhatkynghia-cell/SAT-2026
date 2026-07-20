import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { predictScore, setGoal } from '@/lib/score-prediction';
import { getUserTier } from '@/lib/subscription-store';

/**
 * SCORE PREDICTION API (Cambridge CEFR)
 *
 * GET  → dự đoán cấp độ CEFR + Cambridge Scale từ mastery + mục tiêu + skill cần tập trung.
 * POST → đặt bậc CEFR mục tiêu { targetLevel } (A1/A2/B1).
 *
 * PHÂN TẦNG: server LUÔN tính full prediction (dữ liệu vẫn tích lũy đủ ở free),
 * nhưng CẮT tầng HIỂN THỊ theo tier — free chỉ thấy cấp độ tổng (miếng mồi),
 * premium/ultimate mở focus skills + chi tiết. Redact SERVER-SIDE.
 */

export async function GET() {
  const user = await getCurrentUser();
  const [prediction, tier] = await Promise.all([
    predictScore(user.id),
    getUserTier(user.id),
  ]);

  // Free → khóa chi tiết: giữ cấp độ/scale/độ tin cậy/mục tiêu, ẩn focus skills.
  if (tier === 'free') {
    return NextResponse.json({
      ...prediction,
      focusSkills: [],
      detailLocked: true,
    });
  }

  return NextResponse.json({ ...prediction, detailLocked: false });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { targetLevel } = await req.json();

    if (targetLevel !== 'A1' && targetLevel !== 'A2' && targetLevel !== 'B1') {
      return NextResponse.json({ error: 'targetLevel phải là A1, A2 hoặc B1' }, { status: 400 });
    }

    const goal = await setGoal(user.id, targetLevel);
    return NextResponse.json({ success: true, goal, prediction: await predictScore(user.id) });
  } catch (error) {
    console.error('Lỗi đặt mục tiêu:', error);
    return NextResponse.json({ error: 'Failed to set goal' }, { status: 500 });
  }
}
