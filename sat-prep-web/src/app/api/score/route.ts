import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { predictScore, setGoal, type ScorePrediction } from '@/lib/score-prediction';
import { getUserTier } from '@/lib/subscription-store';
import type { AiTier } from '@/lib/ai-quota';

/**
 * Cắt tầng HIỂN THỊ theo tier: free chỉ thấy TỔNG điểm (miếng mồi), premium/
 * ultimate mở breakdown môn + focus skills. Redact SERVER-SIDE để client free
 * không đọc được breakdown từ network response — dùng chung cho GET và POST.
 */
function redactForTier(prediction: ScorePrediction, tier: AiTier) {
  if (tier === 'free') {
    return { ...prediction, math: null, reading: null, focusSkills: [], detailLocked: true };
  }
  return { ...prediction, detailLocked: false };
}

/**
 * SCORE PREDICTION API (implementation_plan.md §10.A.5, task #11)
 *
 * GET  → dự đoán điểm SAT 400-1600 từ mastery + mục tiêu + skill cần tập trung.
 * POST → đặt điểm mục tiêu { targetScore } (400..1600).
 *
 * PHÂN TẦNG (định giá theo phễu 2026-07-06): server LUÔN tính full prediction
 * (dữ liệu vẫn tích lũy đủ ở free), nhưng CẮT tầng HIỂN THỊ theo tier —
 * free chỉ thấy TỔNG điểm (miếng mồi), premium/ultimate mở breakdown môn +
 * focus skills. Redact SERVER-SIDE (không chỉ ẩn ở UI) để client free không
 * đọc được breakdown từ network response. Nâng cấp = mở khóa dữ liệu đã có.
 */

export async function GET() {
  const user = await getCurrentUser();
  const [prediction, tier] = await Promise.all([
    predictScore(user.id),
    getUserTier(user.id),
  ]);

  return NextResponse.json(redactForTier(prediction, tier));
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { targetScore } = await req.json();

    if (typeof targetScore !== 'number' || Number.isNaN(targetScore)) {
      return NextResponse.json({ error: 'targetScore phải là số (400..1600)' }, { status: 400 });
    }

    const goal = await setGoal(user.id, targetScore);
    const [prediction, tier] = await Promise.all([
      predictScore(user.id),
      getUserTier(user.id),
    ]);
    return NextResponse.json({ success: true, goal, prediction: redactForTier(prediction, tier) });
  } catch (error) {
    console.error('Lỗi đặt mục tiêu:', error);
    return NextResponse.json({ error: 'Failed to set goal' }, { status: 500 });
  }
}
