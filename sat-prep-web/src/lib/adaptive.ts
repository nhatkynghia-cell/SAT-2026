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

/**
 * ============================================================================
 *  THÁP VÔ TẬN (Tower) — chọn skill + độ khó cho từng tầng
 * ============================================================================
 *  Mục tiêu kép: GÂY NGHIỆN (giữ người chơi trong "flow") + VẪN HỌC (câu rơi
 *  đúng vùng phát triển gần, ghi mastery đúng skill).
 *
 *  • Độ khó = NỀN ZPD theo mastery + ÁP LỰC theo tầng (càng cao càng khó), cap Hard.
 *    → học sinh yếu khởi đầu bằng câu thắng được (chống rage-quit) nhưng trần vẫn
 *      dâng theo tầng; học sinh giỏi vào Hard ngay (không nhàm).
 *  • Skill = XOAY VÒNG trong nhóm skill YẾU NHẤT theo số tầng → mỗi tầng một chủ đề
 *      khác (đỡ nhàm) mà vẫn dồn vào điểm yếu cần luyện.
 * ============================================================================
 */

/** Thang độ khó 3 bậc — dùng để cộng "áp lực tầng" lên nền ZPD. */
const DIFFICULTY_LADDER: Difficulty[] = ['Easy', 'Medium', 'Hard'];

/** Số skill yếu nhất đưa vào vòng xoay mỗi run Tower (đa dạng chủ đề). */
export const TOWER_SKILL_WINDOW = 5;

/**
 * Độ khó câu hỏi cho 1 tầng Tower: nền ZPD theo mastery, cộng áp lực tầng.
 *   floor 1-8  → +0   (khởi động, giữ flow)
 *   floor 9-16 → +1
 *   floor 17+  → +2
 * Kết quả kẹp trong [Easy..Hard].
 */
export function towerDifficulty(masteryScore: number, floor: number): Difficulty {
  const base = DIFFICULTY_LADDER.indexOf(selectDifficulty(masteryScore)); // 0..2
  const pressure = floor <= 8 ? 0 : floor <= 16 ? 1 : 2;
  const idx = Math.min(DIFFICULTY_LADDER.length - 1, base + pressure);
  return DIFFICULTY_LADDER[idx];
}

export interface TowerPick {
  skillId: string;
  label: string;
  moduleType: string;
  masteryScore: number;
  difficulty: Difficulty;
}

/**
 * Chọn skill + độ khó cho 1 tầng Tower (math-only — Tower là "Math Survival").
 * Xoay vòng trong nhóm skill yếu nhất (ưu tiên chưa thành thạo) theo số tầng.
 * Trả null nếu không có skill math nào (summary rỗng).
 */
export function pickTowerSkill(
  skills: MasterySummary['skills'],
  floor: number
): TowerPick | null {
  const mathSkills = skills.filter((s) => s.moduleType === 'math');
  if (mathSkills.length === 0) return null;

  // Ưu tiên skill CHƯA thành thạo; nếu đã thạo hết thì ôn duy trì trên toàn bộ.
  const notMastered = mathSkills.filter((s) => !s.mastered);
  const ranked = [...(notMastered.length > 0 ? notMastered : mathSkills)];

  // Yếu nhất trước; cùng score thì ít luyện hơn trước (độ phủ) — như recommendNext.
  ranked.sort((a, b) => a.score - b.score || a.attempts - b.attempts);

  // Cửa sổ skill yếu nhất rồi xoay theo tầng → mỗi tầng một chủ đề khác.
  const window = ranked.slice(0, Math.min(TOWER_SKILL_WINDOW, ranked.length));
  const pick = window[(floor - 1) % window.length];

  return {
    skillId: pick.id,
    label: pick.label,
    moduleType: pick.moduleType,
    masteryScore: pick.score,
    difficulty: towerDifficulty(pick.score, floor),
  };
}

/**
 * ============================================================================
 *  TRẢ LỜI NHANH (Speed Quiz) — chọn skill + độ khó cho từng câu trong lượt
 * ============================================================================
 *  Khác Tower ở 2 điểm:
 *    • ĐA MÔN: rút skill từ MỌI moduleType (Toán + Đọc/Viết + Từ vựng + Desmos…),
 *      không giới hạn Toán — Speed Quiz là "trả lời nhanh toàn diện".
 *    • Áp lực theo SỐ CÂU ĐÃ ĐÚNG trong lượt (không phải "tầng"): càng đúng nhiều
 *      → câu càng khó (giữ thử thách), mirror towerDifficulty nhưng thang riêng.
 *  Vẫn giữ: nền ZPD theo mastery + xoay vòng nhóm skill yếu nhất (đa dạng, dồn
 *  vào điểm yếu, ghi mastery đúng skill qua /api/grade).
 * ============================================================================
 */

/** Số skill yếu nhất đưa vào vòng xoay mỗi lượt Speed Quiz (đa dạng chủ đề, đa môn). */
export const SPEED_QUIZ_SKILL_WINDOW = 8;

/**
 * Độ khó câu Speed Quiz: nền ZPD theo mastery, cộng áp lực theo số câu đã đúng.
 *   0-4 đúng   → +0  (khởi động, giữ flow)
 *   5-9 đúng   → +1
 *   10+ đúng   → +2
 * Kết quả kẹp trong [Easy..Hard]. `answered` = số câu ĐÚNG tính tới hiện tại.
 */
export function speedQuizDifficulty(masteryScore: number, answered: number): Difficulty {
  const base = DIFFICULTY_LADDER.indexOf(selectDifficulty(masteryScore)); // 0..2
  const pressure = answered < 5 ? 0 : answered < 10 ? 1 : 2;
  const idx = Math.min(DIFFICULTY_LADDER.length - 1, base + pressure);
  return DIFFICULTY_LADDER[idx];
}

/**
 * Chọn skill + độ khó cho 1 câu Speed Quiz (đa môn).
 * Xoay vòng trong nhóm skill yếu nhất (ưu tiên chưa thành thạo) theo số câu đã đúng.
 * Trả null nếu summary rỗng (chưa có skill nào để sinh câu).
 */
export function pickSpeedQuizSkill(
  skills: MasterySummary['skills'],
  answered: number
): TowerPick | null {
  if (skills.length === 0) return null;

  // Ưu tiên skill CHƯA thành thạo; nếu đã thạo hết thì ôn duy trì trên toàn bộ.
  const notMastered = skills.filter((s) => !s.mastered);
  const ranked = [...(notMastered.length > 0 ? notMastered : skills)];

  // Yếu nhất trước; cùng score thì ít luyện hơn trước (độ phủ) — như pickTowerSkill.
  ranked.sort((a, b) => a.score - b.score || a.attempts - b.attempts);

  // Cửa sổ skill yếu nhất rồi xoay theo số câu đã đúng → mỗi câu một chủ đề khác.
  const window = ranked.slice(0, Math.min(SPEED_QUIZ_SKILL_WINDOW, ranked.length));
  const pick = window[answered % window.length];

  return {
    skillId: pick.id,
    label: pick.label,
    moduleType: pick.moduleType,
    masteryScore: pick.score,
    difficulty: speedQuizDifficulty(pick.score, answered),
  };
}
