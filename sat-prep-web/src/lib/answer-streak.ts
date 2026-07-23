/**
 * ============================================================================
 *  ANSWER STREAK (pure) — chuỗi câu ĐÚNG liên tiếp SERVER-AUTHORITATIVE
 * ============================================================================
 *  Trước đây /api/grade hardcode streak=0 (combo tắt) vì KHÔNG tin streak client
 *  (client POST streak khổng lồ → bơm xu). Nay server tự đếm streak trong bảng
 *  user_answer_streak (atomic qua RPC bump_answer_streak) → comboMultiplier bật
 *  lại AN TOÀN: mỗi lần đúng là 1 lần CAS answered:false→true (không farm được),
 *  combo trần ×1.75 chỉ đạt khi đúng LIÊN TIẾP 15+ câu THẬT.
 *
 *  ⚠️ THUẦN (pure) — chỉ logic tăng/reset, không I/O. RPC SQL mirror logic này.
 *  Đúng → +1; sai → reset 0. Kẹp current về [0, ∞) (chống dữ liệu rác âm).
 * ============================================================================
 */

/**
 * Chuỗi đúng liên tiếp MỚI sau 1 câu. `current` = streak trước đó (server giữ).
 * Đúng → current+1 (INCLUDE câu hiện tại → dùng trực tiếp cho comboMultiplier).
 * Sai → 0. current rác (âm/NaN/không nguyên) → coi như 0 trước khi +1.
 */
export function nextAnswerStreak(current: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const safe = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  return safe + 1;
}
