/**
 * Digital SAT Scoring Curve — mô phỏng cách College Board quy đổi raw → scaled.
 *
 * Hard path (Module 2 khó): raw 0→200, raw max→800
 * Easy path (Module 2 dễ): raw 0→200, raw max→650 (trần bị cap)
 * Phi tuyến: sai ít ở đỉnh mất nhiều điểm/câu hơn sai nhiều ở đáy.
 */

export type AdaptivePath = 'hard' | 'easy';

export interface SectionScore {
  raw: number;
  total: number;
  scaled: number;
  path: AdaptivePath;
}

export interface ExamScoreResult {
  rw: SectionScore;
  math: SectionScore;
  total: number;
}

const SECTION_MIN = 200;
const HARD_MAX = 800;
const EASY_MAX = 650;

/**
 * Phi tuyến curve: dùng power function để mô phỏng hiệu ứng "sai 1 câu ở top
 * mất nhiều hơn sai 1 câu ở bottom". Exponent < 1 tạo curve lõm (concave up)
 * — tăng nhanh ở đầu, chậm lại ở cuối → sai ít ở trần mất ~30 điểm/câu.
 */
function curvedScale(ratio: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  // exponent 0.85: ratio 0.96 (sai 1/27) → ~0.966 scaled → mất ~20 điểm
  // ratio 0.5 → ~0.54 scaled → khoảng giữa
  const curved = Math.pow(clamped, 0.85);
  const raw = min + curved * (max - min);
  return Math.round(raw / 10) * 10;
}

export function rawToScaled(rawCorrect: number, totalQuestions: number, path: AdaptivePath): number {
  if (totalQuestions === 0) return SECTION_MIN;
  const ratio = rawCorrect / totalQuestions;
  const max = path === 'hard' ? HARD_MAX : EASY_MAX;
  return curvedScale(ratio, SECTION_MIN, max);
}

export interface AnswerSet {
  answers: Record<string, string>;
  correctAnswers: Record<string, string>;
}

export function computeExamScore(
  rwM1: AnswerSet,
  rwM2: AnswerSet,
  mathM1: AnswerSet,
  mathM2: AnswerSet,
  rwPath: AdaptivePath,
  mathPath: AdaptivePath
): ExamScoreResult {
  const rwRaw = countCorrect(rwM1) + countCorrect(rwM2);
  const rwTotal = Object.keys(rwM1.correctAnswers).length + Object.keys(rwM2.correctAnswers).length;
  const mathRaw = countCorrect(mathM1) + countCorrect(mathM2);
  const mathTotal = Object.keys(mathM1.correctAnswers).length + Object.keys(mathM2.correctAnswers).length;

  const rwScaled = rawToScaled(rwRaw, rwTotal, rwPath);
  const mathScaled = rawToScaled(mathRaw, mathTotal, mathPath);

  return {
    rw: { raw: rwRaw, total: rwTotal, scaled: rwScaled, path: rwPath },
    math: { raw: mathRaw, total: mathTotal, scaled: mathScaled, path: mathPath },
    total: rwScaled + mathScaled,
  };
}

function countCorrect(set: AnswerSet): number {
  let count = 0;
  for (const [qId, correct] of Object.entries(set.correctAnswers)) {
    const userAns = set.answers[qId];
    if (userAns && userAns.trim()[0]?.toUpperCase() === correct.trim()[0]?.toUpperCase()) {
      count++;
    }
  }
  return count;
}

/** Adaptive cutoff: Module 1 đạt ngưỡng → Module 2 Hard; else Easy. */
export const RW_M1_CUTOFF = 18;   // 18/27 ≈ 67%
export const MATH_M1_CUTOFF = 15; // 15/22 ≈ 68%

export function determineAdaptivePath(correctCount: number, section: 'rw' | 'math'): AdaptivePath {
  const cutoff = section === 'rw' ? RW_M1_CUTOFF : MATH_M1_CUTOFF;
  return correctCount >= cutoff ? 'hard' : 'easy';
}
