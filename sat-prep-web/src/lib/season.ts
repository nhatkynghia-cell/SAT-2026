/**
 * ============================================================================
 *  SEASON (pure) — mùa giải leaderboard theo THÁNG, KHÔNG cần cron
 * ============================================================================
 *  App KHÔNG có scheduler. Thay vì job reset, "mùa" là NHÃN THỜI GIAN dẫn xuất
 *  từ `now` lúc query: season key = tháng VN (vd '2026-07'). Sang tháng mới →
 *  key mới → UI đổi nhãn, bảng xếp hạng "tươi mới" mà không cần xoá state nào.
 *
 *  ⚠️ Bảng xếp hạng xếp theo NĂNG LỰC HỌC HIỆN TẠI (basePower từ mastery), KHÔNG
 *  reset mastery về 0 khi sang mùa — có chủ đích: khớp anti-pay-to-win và chống
 *  loss-aversion với trẻ vị thành niên (không "mất trắng" công sức mỗi tháng).
 *
 *  Giờ VN (UTC+7) khớp todayVN() (daily-snapshot-store.ts) để nhất quán "hôm nay".
 *  `now` được TIÊM vào để unit-test xác định (như applySpin nhận rng).
 * ============================================================================
 */

const MONTH_LABELS_VI = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

/** Chuyển thời điểm sang các thành phần ngày theo giờ VN (UTC+7). */
function vnParts(now: Date): { year: number; month: number; day: number } {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { year: vn.getUTCFullYear(), month: vn.getUTCMonth() + 1, day: vn.getUTCDate() };
}

/** Season key của mùa hiện tại: 'YYYY-MM' theo giờ VN. */
export function getCurrentSeasonKey(now: Date): string {
  const { year, month } = vnParts(now);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Nhãn hiển thị tiếng Việt: 'Mùa Tháng 7/2026'. Key sai định dạng → trả nguyên key. */
export function getSeasonLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return key;
  return `Mùa ${MONTH_LABELS_VI[monthIdx]}/${year}`;
}

/**
 * Số ngày còn lại của mùa hiện tại (tới hết tháng VN), tính cả hôm nay.
 * Dùng cho UI đếm ngược. Vd ngày cuối tháng → 1.
 */
export function daysLeftInSeason(now: Date): number {
  const { year, month, day } = vnParts(now);
  // Ngày cuối tháng: ngày 0 của tháng kế = ngày cuối tháng hiện tại.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return daysInMonth - day + 1;
}
