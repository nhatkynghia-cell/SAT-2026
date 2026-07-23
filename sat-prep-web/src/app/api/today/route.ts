import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { recommendNext } from '@/lib/adaptive';
import { buildTodayPlan } from '@/lib/today-plan';
import { loadVocab } from '@/lib/vocab-store';
import { loadMistakes } from '@/lib/mistakes-store';
import { isDue, todayStr } from '@/lib/leitner';
import { computeWeeklyTrend } from '@/lib/daily-snapshot';
import { loadOwnSnapshots } from '@/lib/daily-snapshot-store';
import { todayVN } from '@/lib/daily-snapshot-store';

/**
 * TODAY API — "Kế hoạch hôm nay" (RPG 60/40, north star).
 *
 * GET → 3 mục nên làm hôm nay (due SRS + skill yếu nhất + stamina) + mastery
 * delta phiên/tuần gần nhất (đo tiến bộ bản thân). KHÔNG gate ultimate (core
 * loop miễn phí cho mọi tier — khác /api/adaptive và /api/journey).
 *
 * Ghép I/O (mastery + vocab/mistakes due + snapshots) với engine thuần
 * (today-plan + daily-snapshot). Server-authoritative, không tin client.
 *
 * Fail-safe: lỗi đọc từng nguồn → dùng 0/null cho nguồn đó, vẫn trả kế hoạch
 * (không vỡ trang chủ khi 1 bảng chưa migrate).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  const summary = await getMasterySummary(user.id);

  // Đếm mục ĐẾN HẠN ôn SRS (vocab + mistakes). Lỗi → 0.
  const today = todayStr();
  let dueCount = 0;
  try {
    const vocab = await loadVocab(user.id);
    dueCount += vocab.words.filter((w) => isDue(w.next_review, today)).length;
  } catch (e) {
    console.error('today: loadVocab lỗi (fail-safe → 0):', e);
  }
  try {
    const mistakes = await loadMistakes(user.id);
    dueCount += mistakes.filter((m) => isDue(m.next_review, today)).length;
  } catch (e) {
    console.error('today: loadMistakes lỗi (fail-safe → 0):', e);
  }

  // Đề xuất skill yếu nhất (recommendNext thuần, KHÔNG gate tier ở đây).
  const recommendation = recommendNext(summary);

  const plan = buildTodayPlan(summary, dueCount, recommendation, new Date().toISOString());

  // Mastery delta tuần (đo tiến bộ bản thân) — từ daily_snapshots. Lỗi → null.
  let weeklyDelta: number | null = null;
  try {
    const todayVn = todayVN();
    const since = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
    const snaps = await loadOwnSnapshots(user.id, since);
    const trend = computeWeeklyTrend(snaps, todayVn);
    weeklyDelta = trend.scoreDelta;
  } catch (e) {
    console.error('today: weekly delta lỗi (fail-safe → null):', e);
  }

  return NextResponse.json({
    plan,
    overall: summary.overall,
    dueCount,
    weeklyDelta,
  });
}
