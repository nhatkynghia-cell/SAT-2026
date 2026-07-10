import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeMastery, type SkillMastery } from './mastery';
import { computePrediction, type ScorePrediction } from './score-prediction';
import { loadSnapshots } from './daily-snapshot-store';
import { computeWeeklyTrend, type WeeklyTrend } from './daily-snapshot';
import { computeDayStreak } from './day-streak';
import { todayVN } from './daily-snapshot-store';
import { getUserTierAdmin } from './subscription-store';
import type { AiTier } from './ai-quota';

/**
 * Cửa sổ xu hướng (số ngày) theo GÓI của CON (phân tầng định giá 2026-07-06):
 * free 7 ngày · premium 30 · ultimate 90. Số câu lịch sử thi hiển thị cũng theo
 * tier (free 5, premium 10, ultimate 20).
 */
const TREND_WINDOW_DAYS: Record<AiTier, number> = { free: 7, premium: 30, ultimate: 90 };
const RECENT_TESTS_LIMIT: Record<AiTier, number> = { free: 5, premium: 10, ultimate: 20 };

/**
 * ============================================================================
 *  PARENT REPORT STORE — gom dữ liệu tiến độ con qua SERVICE-ROLE
 * ============================================================================
 *  Phụ huynh KHÔNG có auth session (Hướng A "mã chia sẻ") → KHÔNG đọc được dữ
 *  liệu con qua RLS (auth.uid()). File NÀY là điểm DUY NHẤT đọc cross-user cho
 *  báo cáo phụ huynh, tất cả qua admin client (service-role, bypass RLS).
 *
 *  🔒 CHỈ TRẢ TIẾN ĐỘ HỌC — KHÔNG email/PII/nội dung nhạy cảm. Caller
 *  (/api/parent/report) đã resolve mã chia sẻ → studentId trước khi gọi.
 * ============================================================================
 */

export interface ParentReport {
  prediction: ScorePrediction;
  mastery: {
    overall: number;
    bySubject: { math: number; reading: number };
    domains: Array<{ domainId: string; domainLabel: string; score: number }>;
  };
  streak: number;
  weeklyTrend: WeeklyTrend;
  recentTests: Array<{ module: string; subject: string; correct: number; total: number; score: number; when: number }>;
  /** Gói của CON — quyết định độ sâu báo cáo. UI hiển thị upsell nếu 'free'. */
  studentTier: AiTier;
  /** Số ngày cửa sổ xu hướng đã dùng (7/30/90 theo tier). */
  trendWindowDays: number;
  /**
   * "Tốc độ cải thiện" THUẦN (không AI): chênh điểm dự đoán + mastery tổng giữa
   * snapshot ĐẦU và CUỐI trong cửa sổ. null khi < 2 snapshot (chưa đủ để so).
   *  • deltaOverall  — chênh mastery tổng 0..100.
   *  • deltaPredicted — chênh điểm SAT dự đoán (tổng 400..1600).
   *  • windowDays    — số ngày cửa sổ (7/30/90 theo tier).
   */
  improvement: { deltaOverall: number; deltaPredicted: number; windowDays: number } | null;
}

export async function buildParentReport(studentId: string): Promise<ParentReport> {
  const admin = createAdminClient();

  // 0) Tier của CON (service-role vì phụ huynh không có session) → độ sâu báo cáo.
  const studentTier = await getUserTierAdmin(studentId);
  const trendWindowDays = TREND_WINDOW_DAYS[studentTier];
  const recentLimit = RECENT_TESTS_LIMIT[studentTier];

  // 1) Mastery (skills JSONB) → summary thuần.
  const { data: mRow } = await admin.from('user_mastery').select('skills').eq('user_id', studentId).maybeSingle();
  const skillsData = (mRow?.skills ?? {}) as Record<string, SkillMastery>;
  const summary = summarizeMastery(skillsData);

  // 2) Goal (target score) → prediction thuần.
  const { data: gRow } = await admin.from('user_goals').select('target_score').eq('user_id', studentId).maybeSingle();
  const targetScore = typeof gRow?.target_score === 'number' ? gRow.target_score : null;
  const prediction = computePrediction(summary, targetScore);

  // 3) Time-series → trend theo cửa sổ tier (7/30/90 ngày).
  const today = todayVN();
  const since = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - (trendWindowDays - 1));
    return dt.toISOString().slice(0, 10);
  })();
  const snapshots = await loadSnapshots(studentId, since);
  const weeklyTrend = computeWeeklyTrend(snapshots, today, trendWindowDays);

  // 4) Streak SERVER-SIDE từ daily_snapshots (không tin blob client save-data —
  //    HS có thể POST user_stats.streak=9999 để lừa phụ huynh). computeDayStreak
  //    dẫn xuất từ ngày CÓ snapshot (server ghi mỗi lần /api/grade).
  const streak = computeDayStreak(snapshots.map((s) => s.snapshot_date), today);

  // Lịch sử thi gần đây (số bài theo tier).
  const { data: hRows } = await admin
    .from('test_history')
    .select('module, subject, correct, total, score, test_timestamp')
    .eq('user_id', studentId)
    .order('test_timestamp', { ascending: false })
    .limit(recentLimit);
  const recentTests = (hRows ?? []).map((r) => ({
    module: r.module,
    subject: r.subject,
    correct: r.correct,
    total: r.total,
    score: r.score,
    when: r.test_timestamp,
  }));

  // Domain averages cho radar (neo domainId thật).
  const domainMap = new Map<string, { label: string; scores: number[] }>();
  for (const s of summary.skills) {
    if (!domainMap.has(s.domainId)) domainMap.set(s.domainId, { label: s.domainLabel, scores: [] });
    domainMap.get(s.domainId)!.scores.push(s.score);
  }
  const domains = Array.from(domainMap.entries()).map(([domainId, v]) => ({
    domainId,
    domainLabel: v.label,
    score: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : 0,
  }));

  // "Tốc độ cải thiện" THUẦN — chênh giữa snapshot ĐẦU và CUỐI trong cửa sổ.
  // snapshots đã sort tăng dần theo ngày (loadSnapshots order ascending). Chỉ
  // tính khi có >= 2 snapshot; total_score là điểm SAT dự đoán tổng (400..1600).
  const improvement =
    snapshots.length >= 2
      ? {
          deltaOverall: snapshots[snapshots.length - 1].overall - snapshots[0].overall,
          deltaPredicted: snapshots[snapshots.length - 1].total_score - snapshots[0].total_score,
          windowDays: trendWindowDays,
        }
      : null;

  return {
    prediction,
    mastery: { overall: summary.overall, bySubject: summary.bySubject, domains },
    streak,
    weeklyTrend,
    recentTests,
    studentTier,
    trendWindowDays,
    improvement,
  };
}
