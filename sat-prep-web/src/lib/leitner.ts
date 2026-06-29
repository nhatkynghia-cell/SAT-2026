/**
 * ============================================================================
 *  LEITNER SPACED-REPETITION (implementation_plan.md §10.A.4, task #13)
 * ============================================================================
 *  Logic "hộp Leitner" dùng CHUNG cho cả:
 *    • Làm Chủ Từ Vựng (api/vocab) — vốn đã có sẵn.
 *    • Sổ tay câu sai resurfacing (api/cau-sai) — mở rộng mới.
 *
 *  Trước đây bảng khoảng-lặp + công thức ngày nằm rải rác trong api/vocab; gom
 *  về đây để hết trùng lặp (điểm yếu code-duplication mà plan §2 đã chỉ ra).
 *
 *  Box 1→5, đúng thì lên box (ôn thưa dần), sai thì rớt về box 1 (ôn dày lại).
 * ============================================================================
 */

/** Khoảng cách ôn lại (số ngày) theo từng box. */
export const BOX_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
export const MAX_BOX = 5;

/** Ngày hôm nay dạng YYYY-MM-DD (chuẩn so sánh chuỗi). */
export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Box mới sau khi ôn: nhớ → lên box (tối đa MAX_BOX); quên → về box 1. */
export function promote(box: number, remembered: boolean): number {
  if (remembered) return Math.min(box + 1, MAX_BOX);
  return 1;
}

/** Ngày ôn lại kế tiếp tính từ hôm nay theo box. */
export function nextReview(box: number): string {
  const d = new Date();
  d.setDate(d.getDate() + (BOX_INTERVALS[box] ?? 1));
  return d.toISOString().split('T')[0];
}

/** Một mục có đến hạn ôn chưa (next_review <= hôm nay, hoặc chưa từng đặt lịch). */
export function isDue(nextReviewDate: string | undefined, today: string = todayStr()): boolean {
  return !nextReviewDate || nextReviewDate <= today;
}
