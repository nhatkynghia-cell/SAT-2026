import type { MasterySummary, Difficulty } from './mastery';
import type { Subject } from './skill-taxonomy';

/**
 * ============================================================================
 *  ADAPTIVE ENGINE (IRT-lite) — implementation_plan.md §10.A.1, task #12
 * ============================================================================
 *  Digital SAT thật là bài thi THÍCH ỨNG (MST): độ khó phục vụ theo năng lực.
 *  Module này mô phỏng nhẹ:
 *    • Coi mastery của skill (0..100) như "theta" (năng lực) trong IRT.
 *    • Chọn ĐỘ KHÓ câu hỏi sao cho rơi vào "vùng phát triển gần" (zone of
 *      proximal development) — không quá dễ (đã thạo) cũng không quá khó.
 *    • Chọn SKILL kế tiếp theo chiến lược học hiệu quả: ưu tiên kỹ năng yếu
 *      nhất chưa thành thạo, đảm bảo độ phủ trước.
 *
 *  ⚠️ THUẦN (pure) — chỉ import TYPE (bị xóa khi biên dịch). Nhận MasterySummary
 *  qua tham số; summary đã nhúng sẵn moduleType + subject của từng skill nên
 *  module này không cần import taxonomy → unit-test được bằng node:test.
 * ============================================================================
 */

/** Ngưỡng mastery để chọn độ khó (vùng phát triển gần). */
export const EASY_CEILING = 35;  // mastery < 35 → câu Easy
export const HARD_FLOOR = 70;    // mastery >= 70 → câu Hard
// khoảng giữa → Medium

/** Chọn độ khó câu hỏi theo mastery hiện tại của skill. */
export function selectDifficulty(masteryScore: number): Difficulty {
  if (masteryScore < EASY_CEILING) return 'Easy';
  if (masteryScore >= HARD_FLOOR) return 'Hard';
  return 'Medium';
}

export interface AdaptiveRecommendation {
  skillId: string;
  label: string;
  moduleType: string;
  difficulty: Difficulty;
  masteryScore: number;
  reason: string;
}

export interface RecommendOptions {
  subject?: Subject;
  moduleType?: string;
}

/**
 * Đề xuất skill + độ khó kế tiếp nên luyện.
 * Trả null nếu không có skill nào khớp bộ lọc.
 */
export function recommendNext(
  summary: MasterySummary,
  opts: RecommendOptions = {}
): AdaptiveRecommendation | null {
  // summary.skills đã nhúng sẵn moduleType + subject (xem getMasterySummary).
  let pool = summary.skills;
  if (opts.subject) pool = pool.filter((s) => s.subject === opts.subject);
  if (opts.moduleType) pool = pool.filter((s) => s.moduleType === opts.moduleType);

  if (pool.length === 0) return null;

  // Ưu tiên skill CHƯA thành thạo; nếu đã thạo hết thì cho ôn duy trì.
  const notMastered = pool.filter((s) => !s.mastered);
  // Sao chép trước khi sort để không mutate mảng của summary (tránh tác dụng phụ).
  const working = [...(notMastered.length > 0 ? notMastered : pool)];

  // Yếu nhất trước (score thấp); cùng score thì ít luyện hơn trước (độ phủ).
  working.sort((a, b) => a.score - b.score || a.attempts - b.attempts);
  const pick = working[0];

  let reason: string;
  if (notMastered.length === 0) {
    reason = 'Mọi kỹ năng đã thành thạo — ôn tập duy trì phong độ.';
  } else if (pick.attempts === 0) {
    reason = 'Kỹ năng chưa luyện lần nào — bắt đầu khám phá để có dữ liệu.';
  } else {
    reason = `Mastery ${pick.score}% — đây là điểm yếu cần củng cố nhất.`;
  }

  return {
    skillId: pick.id,
    label: pick.label,
    moduleType: pick.moduleType,
    difficulty: selectDifficulty(pick.score),
    masteryScore: pick.score,
    reason,
  };
}
