/**
 * ============================================================================
 *  SCORE MATH — LÕI THUẦN (pure) cho Score Prediction — §10.A.5
 * ============================================================================
 *  Tách phần THUẦN (mapping mastery→điểm SAT, ngưỡng confidence) khỏi I/O của
 *  score-prediction.ts (import goals-store → supabase/server → next/headers),
 *  theo đúng mẫu chat-cache.ts ↔ chat-cache-store.ts. Nhờ vậy unit-test được
 *  mà không kéo theo next/headers (không chạy dưới `node --test`).
 *
 *  Công thức SAT: section = 200 + (mastery/100)*600 → mastery 0=200 (sàn),
 *  100=800 (trần), làm tròn bội số 10 như thang điểm thật.
 * ============================================================================
 */

export const SECTION_MIN = 200;
export const SECTION_MAX = 800;
export const SECTION_RANGE = SECTION_MAX - SECTION_MIN; // 600

/** Số câu (toàn hệ) để confidence đạt mức "cao". */
export const FULL_CONFIDENCE_ATTEMPTS = 60;

export type Confidence = 'low' | 'medium' | 'high';

/** Map mastery 0..100 → điểm phần SAT 200..800 (làm tròn bội số 10). */
export function masteryToSection(mastery: number): number {
  const raw = SECTION_MIN + (Math.min(100, Math.max(0, mastery)) / 100) * SECTION_RANGE;
  return Math.round(raw / 10) * 10;
}

/** Độ tin cậy của ước lượng theo tổng số câu đã làm. */
export function confidenceOf(totalAttempts: number): Confidence {
  if (totalAttempts >= FULL_CONFIDENCE_ATTEMPTS) return 'high';
  if (totalAttempts >= FULL_CONFIDENCE_ATTEMPTS / 3) return 'medium';
  return 'low';
}

/** Clamp điểm mục tiêu về thang SAT hợp lệ 400..1600 (làm tròn bội số 10). */
export function clampTargetScore(targetScore: number): number {
  return Math.min(1600, Math.max(400, Math.round(targetScore / 10) * 10));
}
