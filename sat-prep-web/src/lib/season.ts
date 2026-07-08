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

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Chuyển thời điểm sang các thành phần ngày theo giờ VN (UTC+7). */
function vnParts(now: Date): { year: number; month: number; day: number } {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
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

/**
 * ============================================================================
 *  CHU KỲ (day/week/month/year) — tổng quát hoá "mùa" cho Speed Quiz
 * ============================================================================
 *  Bảng xếp hạng "Trả lời nhanh" cần 4 chu kỳ. Vẫn theo triết lý season.ts:
 *  KHÔNG cần scheduler — key là NHÃN THỜI GIAN dẫn xuất từ `now` (giờ VN UTC+7).
 *  Sang chu kỳ mới → key mới → bảng xếp hạng "tươi" mà không xoá state.
 *  Cron (Pha 4) chỉ CHỐT THƯỞNG cuối kỳ, KHÔNG dùng để tính key.
 * ============================================================================
 */

export type SeasonCycle = 'day' | 'week' | 'month' | 'year';

/**
 * Số thứ tự tuần ISO-8601 (tuần bắt đầu THỨ HAI; tuần chứa thứ Năm đầu tiên là
 * tuần 1) + năm-tuần ISO tương ứng, tính theo ngày VN. Trả { year, week }.
 * Năm-tuần có thể lệch năm lịch ở ranh giới (vd 2027-01-01 thuộc tuần cuối 2026).
 */
function isoWeekParts(now: Date): { year: number; week: number } {
  const { year, month, day } = vnParts(now);
  // Ngày UTC "trần" đại diện cho ngày VN (bỏ giờ) để tính toán tuần ổn định.
  const d = new Date(Date.UTC(year, month - 1, day));
  // ISO: Chủ Nhật=7. Dời tới thứ Năm cùng tuần để xác định năm-tuần.
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

/** Key của chu kỳ hiện tại theo giờ VN: day→YYYY-MM-DD, week→YYYY-Www, month→YYYY-MM, year→YYYY. */
export function getCycleKey(now: Date, cycle: SeasonCycle): string {
  const { year, month, day } = vnParts(now);
  switch (cycle) {
    case 'day':
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'week': {
      const w = isoWeekParts(now);
      return `${w.year}-W${String(w.week).padStart(2, '0')}`;
    }
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'year':
      return String(year);
  }
}

/** Nhãn hiển thị tiếng Việt cho một cycle key. Key sai định dạng → trả nguyên key. */
export function getCycleLabel(key: string, cycle: SeasonCycle): string {
  switch (cycle) {
    case 'day': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
      if (!m) return key;
      return `Ngày ${Number(m[3])}/${Number(m[2])}/${m[1]}`;
    }
    case 'week': {
      const m = /^(\d{4})-W(\d{2})$/.exec(key);
      if (!m) return key;
      return `Tuần ${Number(m[2])}/${m[1]}`;
    }
    case 'month':
      return getSeasonLabel(key); // '2026-07' → 'Mùa Tháng 7/2026'
    case 'year': {
      const m = /^(\d{4})$/.exec(key);
      if (!m) return key;
      return `Năm ${m[1]}`;
    }
  }
}

/**
 * Số mili-giây còn lại tới khi chu kỳ hiện tại kết thúc (00:00 VN của chu kỳ kế).
 * Dùng cho UI đếm ngược. Luôn > 0.
 */
export function msLeftInCycle(now: Date, cycle: SeasonCycle): number {
  const { year, month, day } = vnParts(now);
  // Mốc bắt đầu ngày VN hiện tại theo UTC = 00:00 VN = 17:00 UTC hôm trước.
  const todayStartUtc = Date.UTC(year, month - 1, day) - VN_OFFSET_MS;
  let nextStartUtc: number;
  switch (cycle) {
    case 'day':
      nextStartUtc = todayStartUtc + 86400000;
      break;
    case 'week': {
      // ISO: thứ Hai=1..CN=7. Số ngày tới thứ Hai kế tiếp.
      const vn = new Date(now.getTime() + VN_OFFSET_MS);
      const dayNum = vn.getUTCDay() === 0 ? 7 : vn.getUTCDay();
      nextStartUtc = todayStartUtc + (8 - dayNum) * 86400000;
      break;
    }
    case 'month':
      nextStartUtc = Date.UTC(year, month, 1) - VN_OFFSET_MS;
      break;
    case 'year':
      nextStartUtc = Date.UTC(year + 1, 0, 1) - VN_OFFSET_MS;
      break;
  }
  return nextStartUtc - now.getTime();
}
