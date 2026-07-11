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

/**
 * Lệch giờ VN (UTC+7, không DST) — KHỚP todayVN() (daily-snapshot-store.ts) +
 * season.ts để MỌI ranh giới "ngày" trong app nhất quán. Trước đây leitner dùng
 * UTC thuần → ranh giới due/cấp-xu lật lúc 07:00 sáng VN thay vì 00:00, lệch với
 * quest/spin/pvp (đã VN hoá). Đồng bộ về ngày VN cho cả due-filter lẫn cổng wasDue.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Ngày hôm nay theo giờ VN, dạng YYYY-MM-DD (chuẩn so sánh chuỗi).
 * `nowMs` tiêm được để unit-test boundary tất định (mặc định Date.now()).
 */
export function todayStr(nowMs: number = Date.now()): string {
  return new Date(nowMs + VN_OFFSET_MS).toISOString().split('T')[0];
}

/** Box mới sau khi ôn: nhớ → lên box (tối đa MAX_BOX); quên → về box 1. */
export function promote(box: number, remembered: boolean): number {
  if (remembered) return Math.min(box + 1, MAX_BOX);
  return 1;
}

/**
 * Ngày ôn lại kế tiếp = hôm nay (GIỜ VN) + số ngày của box. Cộng ngày trên trục
 * VN (setUTCDate của mốc đã +7h) rồi trả về date-string → khớp ranh giới ngày VN
 * của todayStr/isDue. `nowMs` tiêm được để test tất định.
 */
export function nextReview(box: number, nowMs: number = Date.now()): string {
  const d = new Date(nowMs + VN_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + (BOX_INTERVALS[box] ?? 1));
  return d.toISOString().split('T')[0];
}

/** Một mục có đến hạn ôn chưa (next_review <= hôm nay VN, hoặc chưa từng đặt lịch). */
export function isDue(nextReviewDate: string | undefined, today: string = todayStr()): boolean {
  return !nextReviewDate || nextReviewDate <= today;
}
