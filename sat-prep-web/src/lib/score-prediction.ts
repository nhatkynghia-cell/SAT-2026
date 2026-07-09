import { getMasterySummary, type MasterySummary } from './mastery';
import { loadGoal, saveGoal } from './goals-store';
import { getDomainOfSkill } from './skill-taxonomy';
import {
  masteryToSection,
  confidenceOf,
  clampTargetScore,
  type Confidence,
} from './score-math';

/**
 * ============================================================================
 *  SCORE PREDICTION — dự đoán điểm SAT 400-1600 (implementation_plan.md §10.A.5)
 * ============================================================================
 *  Map mastery mỗi môn (0..100) → điểm phần SAT (200..800), tổng 400..1600.
 *  Đây là lớp mỏng nằm trên Mastery (task #9): "thứ học sinh & phụ huynh muốn
 *  biết nhất", và là dữ liệu chủ lực cho Parent Dashboard (Phase 2).
 *
 *  ⚠️ Đây là ƯỚC LƯỢNG ĐỘNG VIÊN dựa trên hiệu suất luyện tập trong app, KHÔNG
 *  phải điểm SAT chính thức. Độ tin cậy (confidence) tăng theo số câu đã làm —
 *  làm ít thì ước lượng chỉ mang tính tham khảo.
 *
 *  Lõi tính toán THUẦN (masteryToSection/confidenceOf/clampTargetScore) tách
 *  sang score-math.ts để unit-test được; re-export type Confidence ở đây để
 *  caller cũ vẫn import từ score-prediction như trước.
 * ============================================================================
 */

export type { Confidence };

export interface GoalData {
  targetScore: number; // điểm mục tiêu 400..1600
  updatedAt: string;
}

export interface ScorePrediction {
  /** Điểm phần (đã làm tròn bội số 10). */
  math: number;
  reading: number;
  /** Tổng 400..1600. */
  total: number;
  confidence: Confidence;
  totalAttempts: number;
  /** Mục tiêu (nếu user đã đặt) + còn cách bao nhiêu điểm. */
  targetScore: number | null;
  pointsToTarget: number | null;
  /** Tối đa 3 skill yếu nhất (đã làm ≥1 lần hoặc điểm thấp) nên tập trung. */
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
}

export async function getGoal(userId: string): Promise<GoalData | null> {
  return loadGoal(userId);
}

/** Đặt điểm mục tiêu (clamp về 400..1600, làm tròn bội số 10). */
export async function setGoal(userId: string, targetScore: number): Promise<GoalData> {
  const goal: GoalData = { targetScore: clampTargetScore(targetScore), updatedAt: new Date().toISOString() };
  await saveGoal(userId, goal);
  return goal;
}

export async function predictScore(userId: string): Promise<ScorePrediction> {
  const summary = await getMasterySummary(userId);
  const goal = await getGoal(userId);
  return computePrediction(summary, goal?.targetScore ?? null);
}

/**
 * Tính ScorePrediction THUẦN từ MasterySummary + điểm mục tiêu (không I/O). Tách
 * khỏi predictScore để đường phụ huynh (đọc dữ liệu con qua service-role) tái
 * dụng cùng công thức mà không cần RLS session của con.
 */
export function computePrediction(summary: MasterySummary, targetScore: number | null): ScorePrediction {
  const math = masteryToSection(summary.bySubject.math);
  const reading = masteryToSection(summary.bySubject.reading);
  const total = math + reading;

  const totalAttempts = summary.skills.reduce((sum, s) => sum + s.attempts, 0);
  const reliableSkills = summary.skills.filter((s) => s.reliable).length;
  const confidence = confidenceOf(totalAttempts, reliableSkills);

  const pointsToTarget = targetScore !== null ? Math.max(0, targetScore - total) : null;

  // Gợi ý 3 skill cần tập trung: ưu tiên skill đã từng làm (attempts>0) và điểm thấp;
  // nếu chưa làm gì thì gợi ý 3 skill bất kỳ để khởi động.
  const attempted = summary.skills.filter((s) => s.attempts > 0);
  const ranked = (attempted.length > 0 ? attempted : summary.skills)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => {
      const domain = getDomainOfSkill(s.id);
      return { id: s.id, label: s.label, score: s.score, subject: domain?.subject ?? 'math' };
    });

  return {
    math,
    reading,
    total,
    confidence,
    totalAttempts,
    targetScore,
    pointsToTarget,
    focusSkills: ranked,
  };
}
