/**
 * ============================================================================
 *  DAILY SNAPSHOT — time-series tiến độ theo ngày (Parent Dashboard §báo-cáo-tuần)
 * ============================================================================
 *  App chỉ có snapshot mastery HIỆN TẠI. Để vẽ "xu hướng tuần" cho phụ huynh cần
 *  time-series → ghi 1 ảnh chụp/ngày (lazy: mỗi khi nộp câu qua /api/grade).
 *
 *  Module THUẦN (pure): build từ MasterySummary + tính trend từ mảng snapshot.
 *  Ngày VN (UTC+7) do CALLER tiêm (DI) — KHÔNG gọi Date ở đây để unit-test được
 *  (mẫu score-math.ts / gate-exam.ts).
 *
 *  ⚠️ Công thức mastery→section INLINE (không import score-math) để module thuần
 *  không kéo value-import extensionless mà `node --test` không resolve được (bài
 *  học mistake-variant). Công thức = bản sao score-math.masteryToSection: thang
 *  SAT cố định 200..800, đã có test riêng ở score-math.test.ts.
 * ============================================================================
 */

/** Map mastery 0..100 → điểm phần SAT 200..800 (làm tròn bội số 10). Đồng bộ score-math.ts. */
function masteryToSection(mastery: number): number {
  const raw = 200 + (Math.min(100, Math.max(0, mastery)) / 100) * 600;
  return Math.round(raw / 10) * 10;
}

export interface DailySnapshot {
  snapshot_date: string; // 'YYYY-MM-DD' (ngày VN)
  overall: number;
  math_section: number;
  reading_section: number;
  total_score: number;
  total_attempts: number;
}

/** Dữ liệu tối thiểu từ getMasterySummary mà snapshot cần (tránh phụ thuộc I/O). */
export interface SummaryLike {
  bySubject: { math: number; reading: number };
  overall: number;
  skills: Array<{ attempts: number }>;
}

/** Ảnh chụp tiến độ hiện tại (KHÔNG kèm ngày — store gắn ngày lúc ghi). */
export function buildSnapshotFromSummary(summary: SummaryLike): Omit<DailySnapshot, 'snapshot_date'> {
  const math_section = masteryToSection(summary.bySubject.math);
  const reading_section = masteryToSection(summary.bySubject.reading);
  return {
    overall: summary.overall,
    math_section,
    reading_section,
    total_score: math_section + reading_section,
    total_attempts: summary.skills.reduce((sum, s) => sum + (s.attempts || 0), 0),
  };
}

/** Lùi `days` ngày từ 'YYYY-MM-DD' (số học lịch, không phụ thuộc timezone runtime). */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface WeeklyTrend {
  /** Điểm tổng mới nhất (snapshot gần nhất trong 7 ngày, hoặc null nếu chưa có). */
  latestTotal: number | null;
  /** Điểm tổng ~7 ngày trước (snapshot cũ nhất trong cửa sổ) để so sánh. */
  weekAgoTotal: number | null;
  /** Chênh lệch điểm tổng trong tuần (latest - weekAgo). */
  scoreDelta: number;
  /** Số câu đã làm trong 7 ngày qua (tổng attempts mới nhất - của ~7 ngày trước). */
  attemptsThisWeek: number;
  /** Chuỗi điểm tổng theo ngày (7 ngày gần nhất, chỉ ngày CÓ snapshot) để vẽ mini-chart. */
  series: Array<{ date: string; total: number }>;
  /** Số ngày có hoạt động (có snapshot) trong 7 ngày. */
  activeDays: number;
}

/**
 * Tính xu hướng từ mảng snapshot + ngày hôm nay (VN, 'YYYY-MM-DD').
 * Chỉ xét snapshot trong [today-(windowDays-1), today]. Ngày trống bỏ qua (không nội suy).
 *
 * `windowDays` mặc định 7 (dashboard học sinh + báo cáo phụ huynh free). Báo cáo
 * phụ huynh Premium=30, Ultimate=90 (phân tầng định giá 2026-07-06) truyền vào đây.
 */
export function computeWeeklyTrend(
  snapshots: DailySnapshot[],
  todayVN: string,
  windowDays = 7
): WeeklyTrend {
  const since = shiftDate(todayVN, -(windowDays - 1));
  const inWindow = snapshots
    .filter((s) => s.snapshot_date >= since && s.snapshot_date <= todayVN)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (inWindow.length === 0) {
    return { latestTotal: null, weekAgoTotal: null, scoreDelta: 0, attemptsThisWeek: 0, series: [], activeDays: 0 };
  }

  const oldest = inWindow[0];
  const latest = inWindow[inWindow.length - 1];

  return {
    latestTotal: latest.total_score,
    weekAgoTotal: oldest.total_score,
    scoreDelta: latest.total_score - oldest.total_score,
    // Câu làm trong tuần = attempts tích lũy mới nhất - của mốc cũ nhất trong cửa sổ.
    // (attempts là tổng tích lũy nên hiệu = số câu làm giữa 2 mốc.) Kẹp >= 0.
    attemptsThisWeek: Math.max(0, latest.total_attempts - oldest.total_attempts),
    series: inWindow.map((s) => ({ date: s.snapshot_date, total: s.total_score })),
    activeDays: inWindow.length,
  };
}
