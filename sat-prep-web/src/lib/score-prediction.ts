import { getMasterySummary, type MasterySummary } from './mastery';
import { loadGoal, saveGoal } from './goals-store';
import { getDomainOfSkill } from './skill-taxonomy';
import { loadSnapshots } from './daily-snapshot-store';
import {
  masteryToScale,
  masteryToCEFR,
  cefrToScale,
  confidenceOf,
  clampTargetLevel,
  predictETA,
  type Confidence,
  type CEFRLevel,
} from './score-math';

/**
 * ============================================================================
 *  SCORE PREDICTION — dự đoán cấp độ CEFR + Cambridge Scale (KET/PET)
 * ============================================================================
 *  Map mastery tổng thể (0..100) → Cambridge Scale (82..170) + nhãn CEFR
 *  (Pre-A1/A1/A2/B1). Đây là lớp mỏng trên Mastery — "thứ học sinh & phụ huynh
 *  muốn biết nhất", dữ liệu chủ lực cho Parent Dashboard.
 *
 *  ⚠️ Đây là ƯỚC LƯỢNG ĐỘNG VIÊN dựa trên hiệu suất luyện tập trong app, KHÔNG
 *  phải điểm thi Cambridge chính thức. Độ tin cậy tăng theo số câu đã làm.
 *
 *  Lõi tính toán THUẦN (score-math.ts) tách để unit-test được.
 * ============================================================================
 */

export type { Confidence, CEFRLevel };

export interface GoalData {
  targetLevel: CEFRLevel; // bậc CEFR mục tiêu (A1/A2/B1)
  updatedAt: string;
}

export interface ScorePrediction {
  /** Mastery tổng thể 0..100. */
  overallMastery: number;
  /** Cambridge Scale hiện tại (82..170). */
  scale: number;
  /** Nhãn CEFR hiện tại. */
  cefr: CEFRLevel;
  confidence: Confidence;
  totalAttempts: number;
  /** Mục tiêu (nếu user đã đặt) + mốc scale + còn cách bao nhiêu điểm + ETA ngày. */
  targetLevel: CEFRLevel | null;
  targetScale: number | null;
  scaleToTarget: number | null;
  etaDays: number | null;
  /** Tối đa 3 skill yếu nhất nên tập trung. */
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
}

export async function getGoal(userId: string): Promise<GoalData | null> {
  return loadGoal(userId);
}

/** Đặt bậc CEFR mục tiêu (chuẩn hoá về A1/A2/B1). */
export async function setGoal(userId: string, targetLevel: string): Promise<GoalData> {
  const goal: GoalData = { targetLevel: clampTargetLevel(targetLevel), updatedAt: new Date().toISOString() };
  await saveGoal(userId, goal);
  return goal;
}

export async function predictScore(userId: string): Promise<ScorePrediction> {
  const summary = await getMasterySummary(userId);
  const goal = await getGoal(userId);
  // Tốc độ tăng scale/ngày ước lượng từ lịch sử snapshot 14 ngày gần nhất.
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const snapshots = await loadSnapshots(userId, since).catch(() => [] as Awaited<ReturnType<typeof loadSnapshots>>);
  const scalePerDay = estimateScaleVelocity(snapshots);
  return computePrediction(summary, goal?.targetLevel ?? null, scalePerDay);
}

/** Ước lượng tốc độ tăng Cambridge Scale mỗi ngày từ chuỗi snapshot gần đây. */
function estimateScaleVelocity(snapshots: Array<{ overall_scale?: number; snapshot_date?: string }>): number {
  const pts = snapshots
    .filter((s) => typeof s.overall_scale === 'number' && s.snapshot_date)
    .slice(-14);
  if (pts.length < 2) return 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = Math.max(
    1,
    (new Date(last.snapshot_date as string).getTime() - new Date(first.snapshot_date as string).getTime()) /
      86400000
  );
  const delta = (last.overall_scale as number) - (first.overall_scale as number);
  return delta > 0 ? delta / days : 0;
}

/**
 * Tính ScorePrediction THUẦN từ MasterySummary + bậc mục tiêu + tốc độ (không I/O).
 * Tách khỏi predictScore để đường phụ huynh (service-role) tái dụng cùng công thức.
 */
export function computePrediction(
  summary: MasterySummary,
  targetLevel: CEFRLevel | null,
  scalePerDay = 0
): ScorePrediction {
  const overallMastery = summary.overall;
  const scale = masteryToScale(overallMastery);
  const cefr = masteryToCEFR(overallMastery);

  const totalAttempts = summary.skills.reduce((sum, s) => sum + s.attempts, 0);
  const reliableSkills = summary.skills.filter((s) => s.reliable).length;
  const confidence = confidenceOf(totalAttempts, reliableSkills);

  const targetScale = targetLevel !== null ? cefrToScale(targetLevel) : null;
  const scaleToTarget = targetScale !== null ? Math.max(0, targetScale - scale) : null;
  const eta = targetScale !== null ? predictETA(scale, targetScale, scalePerDay) : null;

  // Gợi ý 3 skill cần tập trung: ưu tiên skill đã từng làm (attempts>0) và điểm thấp.
  const attempted = summary.skills.filter((s) => s.attempts > 0);
  const ranked = (attempted.length > 0 ? attempted : summary.skills)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => {
      const domain = getDomainOfSkill(s.id);
      return { id: s.id, label: s.label, score: s.score, subject: domain?.subject ?? 'foundation' };
    });

  return {
    overallMastery,
    scale,
    cefr,
    confidence,
    totalAttempts,
    targetLevel,
    targetScale,
    scaleToTarget,
    etaDays: eta ? eta.days : null,
    focusSkills: ranked,
  };
}
