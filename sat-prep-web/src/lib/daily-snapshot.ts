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
 *  ⚠️ Công thức mastery→scale INLINE (không import score-math) để module thuần
 *  không kéo value-import extensionless mà `node --test` không resolve được (bài
 *  học mistake-variant). Công thức = BẢN SAO score-math.masteryToScale: Cambridge
 *  Scale 82..170. SỬA 2 NƠI (đây + score-math.ts) — test kiểm chéo ở
 *  daily-snapshot.test.ts đảm bảo đồng nhất.
 * ============================================================================
 */

/** Map mastery 0..100 → Cambridge Scale 82..170. BẢN SAO score-math.masteryToScale. */
function masteryToScale(mastery: number): number {
  const m = Math.min(100, Math.max(0, mastery));
  return 82 + Math.round(m * 0.88);
}

/** Map mastery 0..100 → nhãn CEFR (ngưỡng 20/40/70). BẢN SAO score-math.masteryToCEFR. */
function masteryToCEFR(mastery: number): 'Pre-A1' | 'A1' | 'A2' | 'B1' {
  const m = Math.min(100, Math.max(0, mastery));
  if (m < 20) return 'Pre-A1';
  if (m < 40) return 'A1';
  if (m < 70) return 'A2';
  return 'B1';
}

export interface DailySnapshot {
  snapshot_date: string; // 'YYYY-MM-DD' (ngày VN)
  overall: number;
  overall_scale: number;
  cefr: string;
  total_attempts: number;
}

/** Dữ liệu tối thiểu từ getMasterySummary mà snapshot cần (tránh phụ thuộc I/O). */
export interface SummaryLike {
  overall: number;
  skills: Array<{ attempts: number }>;
}

/** Ảnh chụp tiến độ hiện tại (KHÔNG kèm ngày — store gắn ngày lúc ghi). */
export function buildSnapshotFromSummary(summary: SummaryLike): Omit<DailySnapshot, 'snapshot_date'> {
  return {
    overall: summary.overall,
    overall_scale: masteryToScale(summary.overall),
    cefr: masteryToCEFR(summary.overall),
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
  /** Cambridge Scale mới nhất (snapshot gần nhất trong 7 ngày, hoặc null nếu chưa có). */
  latestScale: number | null;
  /** Cambridge Scale ~7 ngày trước (snapshot cũ nhất trong cửa sổ) để so sánh. */
  weekAgoScale: number | null;
  /** Chênh lệch Cambridge Scale trong tuần (latest - weekAgo). */
  scoreDelta: number;
  /** Số câu đã làm trong 7 ngày qua (tổng attempts mới nhất - của ~7 ngày trước). */
  attemptsThisWeek: number;
  /** Chuỗi scale theo ngày (7 ngày gần nhất, chỉ ngày CÓ snapshot) để vẽ mini-chart. */
  series: Array<{ date: string; scale: number }>;
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
    return { latestScale: null, weekAgoScale: null, scoreDelta: 0, attemptsThisWeek: 0, series: [], activeDays: 0 };
  }

  const oldest = inWindow[0];
  const latest = inWindow[inWindow.length - 1];

  return {
    latestScale: latest.overall_scale,
    weekAgoScale: oldest.overall_scale,
    scoreDelta: latest.overall_scale - oldest.overall_scale,
    // Câu làm trong tuần = attempts tích lũy mới nhất - của mốc cũ nhất trong cửa sổ.
    attemptsThisWeek: Math.max(0, latest.total_attempts - oldest.total_attempts),
    series: inWindow.map((s) => ({ date: s.snapshot_date, scale: s.overall_scale })),
    activeDays: inWindow.length,
  };
}
