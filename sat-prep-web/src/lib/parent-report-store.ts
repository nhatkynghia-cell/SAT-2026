import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeMastery, type SkillMastery } from './mastery';
import { computePrediction, type ScorePrediction } from './score-prediction';
import { loadSnapshots } from './daily-snapshot-store';
import { computeWeeklyTrend, type WeeklyTrend } from './daily-snapshot';
import { todayVN } from './daily-snapshot-store';

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
}

/** Đọc streak của con từ user_progress.data_json (signed JSON) — chỉ parse lấy streak. */
async function readStreak(admin: ReturnType<typeof createAdminClient>, studentId: string): Promise<number> {
  const { data } = await admin.from('user_progress').select('data_json').eq('user_id', studentId).maybeSingle();
  if (!data?.data_json || typeof data.data_json !== 'string') return 0;
  try {
    const parsed = JSON.parse(data.data_json);
    const streak = parsed?.user_stats?.streak;
    return typeof streak === 'number' && streak >= 0 ? streak : 0;
  } catch {
    return 0;
  }
}

export async function buildParentReport(studentId: string): Promise<ParentReport> {
  const admin = createAdminClient();

  // 1) Mastery (skills JSONB) → summary thuần.
  const { data: mRow } = await admin.from('user_mastery').select('skills').eq('user_id', studentId).maybeSingle();
  const skillsData = (mRow?.skills ?? {}) as Record<string, SkillMastery>;
  const summary = summarizeMastery(skillsData);

  // 2) Goal (target score) → prediction thuần.
  const { data: gRow } = await admin.from('user_goals').select('target_score').eq('user_id', studentId).maybeSingle();
  const targetScore = typeof gRow?.target_score === 'number' ? gRow.target_score : null;
  const prediction = computePrediction(summary, targetScore);

  // 3) Time-series 7 ngày → weekly trend.
  const today = todayVN();
  const since = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 6);
    return dt.toISOString().slice(0, 10);
  })();
  const snapshots = await loadSnapshots(studentId, since);
  const weeklyTrend = computeWeeklyTrend(snapshots, today);

  // 4) Streak + lịch sử thi gần đây (tối đa 5).
  const streak = await readStreak(admin, studentId);
  const { data: hRows } = await admin
    .from('test_history')
    .select('module, subject, correct, total, score, test_timestamp')
    .eq('user_id', studentId)
    .order('test_timestamp', { ascending: false })
    .limit(5);
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

  return {
    prediction,
    mastery: { overall: summary.overall, bySubject: summary.bySubject, domains },
    streak,
    weeklyTrend,
    recentTests,
  };
}
