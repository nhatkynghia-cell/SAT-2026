import type { MasterySummary } from './mastery';
import { MASTERED_THRESHOLD } from './mastery';
import { cefrToScale, masteryToScale, type CEFRLevel } from './score-math';

/**
 * ============================================================================
 *  JOURNEY PLAN — LÕI THUẦN (pure) dựng lộ trình luyện theo tuần (Cụm A2)
 * ============================================================================
 *  "Lộ Trình Cá Nhân": từ mastery hiện tại + điểm mục tiêu → kế hoạch nhiều
 *  tuần, mỗi tuần dồn vào NHÓM kỹ năng YẾU NHẤT chưa thành thạo, gợi ý số buổi
 *  luyện theo độ hụt so với ngưỡng tinh thông (MASTERED_THRESHOLD).
 *
 *  ⚠️ THUẦN (pure) — KHÔNG I/O, KHÔNG gọi API/DB. Nhận MasterySummary +
 *  targetLevel + `now` (tiêm vào để tất định, unit-test được), theo đúng mẫu
 *  adaptive.ts. summary.skills đã nhúng sẵn moduleType nên không cần import
 *  taxonomy. Cùng công thức điểm với score-prediction (masteryToSection).
 * ============================================================================
 */

/** Số kỹ năng tối đa gom vào mỗi tuần (đủ dày để tiến bộ, không quá tải). */
export const SKILLS_PER_WEEK = 4;

/** Số tuần tối đa của một lộ trình (bao trọn phần lớn cây kỹ năng SAT). */
export const MAX_WEEKS = 4;

export interface PlanFocusSkill {
  skillId: string;
  label: string;
  moduleType: string;
  masteryScore: number;
  /** Số buổi luyện gợi ý trong tuần cho kỹ năng này (theo độ hụt so với tinh thông). */
  targetSessions: number;
}

export interface PlanWeek {
  weekIndex: number; // bắt đầu từ 1
  focusSkills: PlanFocusSkill[];
  rationale: string;
}

export interface WeeklyPlan {
  generatedAt: string;
  targetLevel: CEFRLevel | null;
  /** Còn cách mục tiêu bao nhiêu điểm (chỉ có khi đã đặt targetLevel). */
  scaleToTarget?: number;
  weeks: PlanWeek[];
}

/**
 * Số buổi luyện gợi ý cho 1 kỹ năng theo độ hụt so với ngưỡng tinh thông.
 * Hụt càng nhiều → cần luyện càng nhiều buổi; kẹp trong [1..5] để thực tế.
 */
function sessionsForGap(masteryScore: number): number {
  const gap = MASTERED_THRESHOLD - masteryScore;
  if (gap <= 0) return 1; // đã gần/đạt tinh thông → 1 buổi ôn duy trì
  return Math.min(5, Math.max(1, Math.ceil(gap / 15)));
}

/**
 * Dựng lộ trình luyện theo tuần THUẦN từ mastery + điểm mục tiêu.
 *
 * Chiến lược: lấy kỹ năng CHƯA thành thạo, sắp yếu-nhất-trước (cùng score thì ít
 * luyện hơn trước để phủ đều), rồi chia thành các tuần ~SKILLS_PER_WEEK kỹ năng
 * (tối đa MAX_WEEKS tuần). Nếu đã tinh thông hết thì trả lộ trình rỗng (weeks=[]).
 */
export function buildWeeklyPlan(
  summary: MasterySummary,
  targetLevel: CEFRLevel | null,
  now: string
): WeeklyPlan {
  // Cambridge Scale hiện tại (cùng công thức score-prediction) → còn cách mục tiêu bao nhiêu scale point.
  const currentScale = masteryToScale(summary.overall);
  const targetScale = targetLevel !== null ? cefrToScale(targetLevel) : null;
  const scaleToTarget = targetScale !== null ? Math.max(0, targetScale - currentScale) : undefined;

  // Ưu tiên kỹ năng CHƯA thành thạo; nếu đã thạo hết thì lộ trình rỗng (không ép luyện).
  const notMastered = summary.skills.filter((s) => !s.mastered);
  // Sao chép trước khi sort để không mutate mảng của summary (mẫu adaptive.ts).
  const ranked = [...notMastered].sort(
    (a, b) => a.score - b.score || a.attempts - b.attempts
  );

  // Cắt còn tối đa MAX_WEEKS * SKILLS_PER_WEEK kỹ năng (phần yếu nhất trước).
  const capacity = MAX_WEEKS * SKILLS_PER_WEEK;
  const selected = ranked.slice(0, capacity);

  const weeks: PlanWeek[] = [];
  for (let i = 0; i < selected.length; i += SKILLS_PER_WEEK) {
    const chunk = selected.slice(i, i + SKILLS_PER_WEEK);
    const weekIndex = weeks.length + 1;
    const focusSkills: PlanFocusSkill[] = chunk.map((s) => ({
      skillId: s.id,
      label: s.label,
      moduleType: s.moduleType,
      masteryScore: s.score,
      targetSessions: sessionsForGap(s.score),
    }));

    const avg = Math.round(chunk.reduce((sum, s) => sum + s.score, 0) / chunk.length);
    const rationale =
      weekIndex === 1
        ? `Bắt đầu từ ${chunk.length} kỹ năng yếu nhất (mastery trung bình ${avg}%) — vá lỗ hổng lớn nhất trước để lên điểm nhanh.`
        : `Tuần ${weekIndex}: củng cố tiếp ${chunk.length} kỹ năng (mastery trung bình ${avg}%) sau khi đã cải thiện nhóm trước.`;

    weeks.push({ weekIndex, focusSkills, rationale });
  }

  return {
    generatedAt: now,
    targetLevel,
    ...(scaleToTarget !== undefined ? { scaleToTarget } : {}),
    weeks,
  };
}
