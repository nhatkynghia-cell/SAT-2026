import type { MasterySummary } from './mastery';
import type { AdaptiveRecommendation } from './adaptive';

/**
 * ============================================================================
 *  TODAY PLAN — LÕI THUẦN (pure) dựng "Kế hoạch hôm nay" 3 mục (RPG 60/40)
 * ============================================================================
 *  North star của app (xem memory product-optimization-roadmap): mỗi ngày học
 *  sinh mở app thấy NGAY 3 việc nên làm hôm nay, gắn vào ĐO TIẾN BỘ BẢN THÂN:
 *    1. Luyện kỹ năng YẾU NHẤT (từ adaptive — mastery thật).
 *    2. Ôn cụm lỗi/vocab ĐẾN HẠN SRS (Leitner due) — chống quên.
 *    3. 1 phiên stamina (luyện nhiều câu / thi ngắn) — xây nhịp.
 *
 *  Khác journey-plan.ts (lộ trình TUẦN, ultimate-only): today-plan là ngày,
 *  miễn phí cho mọi tier (core loop kích thích người mới). Pure: nhận summary
 *  + số đếm due + recommendation + `now` tiêm → tất định, unit-test được.
 * ============================================================================
 */

export interface TodayPlanItem {
  /** 'weakness' | 'due' | 'stamina' — 3 trục của kế hoạch hôm nay. */
  kind: 'weakness' | 'due' | 'stamina';
  title: string;
  /** Đường dẫn client (route practice) để bấm "làm ngay". */
  href: string;
  /** Lý do / số liệu neo vào tiến bộ bản thân (hiện cho user). */
  rationale: string;
  /** Ưu tiên hiển thị (1 cao nhất). */
  priority: number;
}

export interface TodayPlan {
  generatedAt: string;
  items: TodayPlanItem[];
}

/**
 * Đường dẫn practice cho 1 skill (khớp practiceRouteForSkill ở dashboard).
 * vocab/literature → /vocab|/literature; còn lại → /math. Grind là ultimate-only
 * nên KHÔNG dùng cho today-plan (core loop miễn phí).
 */
export function practiceHrefForSkill(skillId: string, moduleType: string): string {
  if (moduleType === 'vocab') return '/vocab';
  if (moduleType === 'literature') return '/literature';
  return '/math';
}

/**
 * Dựng kế hoạch hôm nay THUẦN. `dueCount` = số mục vocab/mistake đến hạn ôn SRS.
 * `recommendation` = đề xuất skill yếu nhất (từ recommendNext); null khi user đã
 * thạo hết hoặc chưa có dữ liệu → vẫn cho mục stamina.
 *
 * Trả 3 mục theo thứ tự ưu tiên: due SRS trước (chống quên là ưu tiên học cao
 * nhất) → weakness → stamina. Thiếu due → bỏ mục due, giữ 2 mục còn lại.
 */
export function buildTodayPlan(
  summary: MasterySummary,
  dueCount: number,
  recommendation: AdaptiveRecommendation | null,
  now: string
): TodayPlan {
  const items: TodayPlanItem[] = [];

  if (dueCount > 0) {
    items.push({
      kind: 'due',
      title: `Ôn ${dueCount} mục đến hạn`,
      href: '/vocab',
      rationale: `${dueCount} từ vựng / câu sai đến hạn ôn lại hôm nay — ôn đúng giờ giúp nhớ lâu (spaced repetition).`,
      priority: 1,
    });
  }

  if (recommendation) {
    const href = practiceHrefForSkill(recommendation.skillId, recommendation.moduleType);
    const dueAlready = items.length > 0 && items[0].kind === 'due';
    items.push({
      kind: 'weakness',
      title: `Luyện: ${recommendation.label}`,
      href,
      rationale: recommendation.reason,
      priority: dueAlready ? 2 : 1,
    });
  }

  // Stamina: luôn có 1 phiên luyện nhiều câu (xây nhịp ngày). Tổng câu đã làm
  // thấp → nhấn "xây thói quen"; cao → "giữ nhịp".
  const totalAttempts = summary.skills.reduce((s, k) => s + k.attempts, 0);
  items.push({
    kind: 'stamina',
    title: totalAttempts < 10 ? 'Phiên khởi động 10 câu' : 'Giữ nhịp luyện hôm nay',
    href: '/math',
    rationale:
      totalAttempts < 10
        ? 'Làm 10 câu trộn hôm nay để app có đủ dữ liệu đo điểm mạnh/yếu của bạn.'
        : 'Duy trì 1 phiên luyện mỗi ngày để chuỗi học (streak) không bị đứt.',
    priority: items.length + 1,
  });

  // Sắp xếp lại theo priority (due/weakness có priority thấp hơn = trước).
  items.sort((a, b) => a.priority - b.priority);

  return { generatedAt: now, items };
}
