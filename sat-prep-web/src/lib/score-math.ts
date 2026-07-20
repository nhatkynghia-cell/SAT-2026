/**
 * ============================================================================
 *  SCORE MATH — LÕI THUẦN (pure) cho Score Prediction (CEFR / Cambridge Scale)
 * ============================================================================
 *  Tách phần THUẦN (mapping mastery→Cambridge Scale + nhãn CEFR, ngưỡng
 *  confidence) khỏi I/O của score-prediction.ts. Unit-test được mà không kéo
 *  next/headers.
 *
 *  App luyện Cambridge KET(A2)/PET(B1). Thay thang SAT 200-1600 bằng:
 *    • Cambridge Scale 82-170 (dải điểm quy đổi của KET/PET/…): mastery 0→82,
 *      100→170, tuyến tính: scale = 82 + round(mastery * 0.88).
 *    • Nhãn CEFR theo ngưỡng mastery: <20 Pre-A1, <40 A1, <70 A2, ≥70 B1.
 *
 *  ⚠️ masteryToScale LẶP LẠI ở daily-snapshot.ts (bản inline, giữ module thuần).
 *  Sửa công thức phải sửa CẢ HAI + test kiểm chéo (daily-snapshot.test.ts).
 * ============================================================================
 */

export const SCALE_MIN = 82;
export const SCALE_MAX = 170;

/** 4 bậc CEFR app hỗ trợ (Pre-A1 → B1). */
export type CEFRLevel = 'Pre-A1' | 'A1' | 'A2' | 'B1';

/** Bậc CEFR user có thể ĐẶT làm mục tiêu (không đặt mục tiêu Pre-A1). */
export const TARGET_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1'];

/** Số câu (toàn hệ) để confidence đạt mức "cao". */
export const FULL_CONFIDENCE_ATTEMPTS = 60;

export type Confidence = 'low' | 'medium' | 'high';

/** Map mastery 0..100 → Cambridge Scale 82..170 (tuyến tính, số nguyên). */
export function masteryToScale(mastery: number): number {
  const m = Math.min(100, Math.max(0, mastery));
  return SCALE_MIN + Math.round(m * 0.88); // m0→82, m50→126, m100→170
}

/** Map mastery 0..100 → nhãn CEFR (ngưỡng 20/40/70). */
export function masteryToCEFR(mastery: number): CEFRLevel {
  const m = Math.min(100, Math.max(0, mastery));
  if (m < 20) return 'Pre-A1';
  if (m < 40) return 'A1';
  if (m < 70) return 'A2';
  return 'B1';
}

/**
 * Điểm Cambridge Scale NEO cho từng bậc CEFR (dùng cho mục tiêu / vạch đích).
 * CHỦ Ý: các mốc này neo theo dải "đạt band" chính thức Cambridge (A2≈120,
 * B1≈140), KHÁC với biên band suy ra từ masteryToScale (B1 tại mastery 70 ≈
 * scale 144). Hai hệ đo song song: masteryToScale = vị trí hiện tại; cefrToScale
 * = mốc mục tiêu → scaleToTarget có thể = 0 khi đã vượt mốc dù nhãn chưa B1.
 */
const CEFR_SCALE_ANCHOR: Record<CEFRLevel, number> = {
  'Pre-A1': 95,
  'A1': 110,
  'A2': 120,
  'B1': 140,
};

/** Điểm Cambridge Scale mốc của một bậc CEFR. */
export function cefrToScale(level: CEFRLevel): number {
  return CEFR_SCALE_ANCHOR[level];
}

/** Độ tin cậy của ước lượng theo tổng số câu đã làm. */
export function confidenceOf(totalAttempts: number): Confidence {
  if (totalAttempts >= FULL_CONFIDENCE_ATTEMPTS) return 'high';
  if (totalAttempts >= FULL_CONFIDENCE_ATTEMPTS / 3) return 'medium';
  return 'low';
}

/** Chuẩn hoá bậc CEFR mục tiêu về giá trị hợp lệ (Pre-A1→A1, lạ→A2). */
export function clampTargetLevel(level: string): CEFRLevel {
  if (level === 'A1' || level === 'A2' || level === 'B1') return level;
  if (level === 'Pre-A1') return 'A1';
  return 'A2';
}

/**
 * Dự đoán số ngày đạt mốc mục tiêu theo tốc độ tăng scale/ngày (thuần).
 *   reached=true nếu đã đạt/vượt mốc; days=null nếu chưa có đà (perDay<=0).
 */
export function predictETA(
  currentScale: number,
  targetScale: number,
  scalePerDay: number
): { days: number | null; reached: boolean } {
  if (currentScale >= targetScale) return { days: 0, reached: true };
  if (scalePerDay <= 0) return { days: null, reached: false };
  return { days: Math.ceil((targetScale - currentScale) / scalePerDay), reached: false };
}
