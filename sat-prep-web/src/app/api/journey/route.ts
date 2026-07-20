import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { getGoal } from '@/lib/score-prediction';
import { getUserTier } from '@/lib/subscription-store';
import { buildWeeklyPlan } from '@/lib/journey-plan';
import { loadPlan, savePlan } from '@/lib/journey-plan-store';

/**
 * JOURNEY API (Cụm A2 — LỘ TRÌNH CÁ NHÂN)
 *
 * GET  → lộ trình luyện theo tuần. Đã có (cache trong user_plans) thì trả luôn;
 *        chưa có → dựng mới từ mastery + điểm mục tiêu hiện tại, lưu rồi trả.
 * POST → tạo lại lộ trình (regenerate) từ mastery + mục tiêu hiện tại, lưu, trả.
 *
 * PHÂN TẦNG: "Lộ Trình Cá Nhân" là quyền lợi ULTIMATE (mẫu /api/adaptive). Free
 * & Premium → { plan: null, locked: true } (200, KHÔNG lộ nội dung). UI hiện
 * upsell. Redact SERVER-SIDE. Mastery vẫn đo đủ ở mọi tier — chỉ khóa tầng ĐỌC.
 */
export async function GET() {
  const user = await getCurrentUser();
  const tier = await getUserTier(user.id);

  // Free & Premium bị khóa; chỉ Ultimate xem lộ trình cá nhân. UI hiện upsell.
  if (tier !== 'ultimate') {
    return NextResponse.json({ plan: null, locked: true });
  }

  // Đã có lộ trình đã lưu → trả luôn (giữ nguyên tới khi user bấm "Tạo lại").
  const existing = await loadPlan(user.id);
  if (existing) {
    return NextResponse.json({ plan: existing, locked: false });
  }

  // Chưa có → dựng mới từ mastery + mục tiêu hiện tại, lưu lại rồi trả.
  const [summary, goal] = await Promise.all([
    getMasterySummary(user.id),
    getGoal(user.id),
  ]);
  const plan = buildWeeklyPlan(summary, goal?.targetLevel ?? null, new Date().toISOString());
  await savePlan(user.id, plan);

  return NextResponse.json({ plan, locked: false });
}

export async function POST() {
  const user = await getCurrentUser();
  const tier = await getUserTier(user.id);

  if (tier !== 'ultimate') {
    return NextResponse.json({ plan: null, locked: true });
  }

  const [summary, goal] = await Promise.all([
    getMasterySummary(user.id),
    getGoal(user.id),
  ]);
  const plan = buildWeeklyPlan(summary, goal?.targetLevel ?? null, new Date().toISOString());
  await savePlan(user.id, plan);

  return NextResponse.json({ plan, locked: false });
}
