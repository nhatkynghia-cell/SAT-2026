/**
 * ============================================================================
 *  DAY-STREAK (pure) — chuỗi NGÀY học liên tiếp 🔥 (đòn bẩy retention #1)
 * ============================================================================
 *  KHÁC `streak` combo (số câu trả lời ĐÚNG liên tiếp, ở economy.ts). Đây là số
 *  NGÀY học liên tiếp theo lịch — cue "quay lại mỗi ngày".
 *
 *  🔴 NGUỒN SỰ THẬT = `daily_snapshots`: mỗi ngày user chấm câu ở /api/grade →
 *  server ghi 1 row (user_id, snapshot_date). Chuỗi ngày DẪN XUẤT từ tập ngày
 *  đó → client KHÔNG fake được (khác hẳn streak combo client tự giữ).
 *
 *  Phần thưởng theo MỐC 7/30/100 ngày, tặng 1 LẦN (idempotent). KHÔNG hệ số nhân
 *  mỗi ngày → faucet có TRẦN rõ, không lạm phát xu. KHÔNG phạt gãy chuỗi (mất
 *  chuỗi chỉ về 0, không mất xu đã có) — tránh loss-aversion với trẻ vị thành niên.
 *
 *  ⚠️ THUẦN (pure) — không I/O. `today` được TIÊM vào (như applySpin) để test
 *  xác định. Tầng I/O (đọc snapshots, ghi economy) ở route + các store.
 * ============================================================================
 */

/** Đổi 'YYYY-MM-DD' → số ngày kể từ epoch (UTC, tham số tường minh nên không
 *  dính múi giờ). Trả null nếu chuỗi sai định dạng. */
function toDayNumber(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Đếm chuỗi ngày học liên tiếp kết thúc ở `today` HOẶC `yesterday`.
 *   • Chuỗi "còn sống" nếu ngày hoạt động gần nhất là hôm nay hoặc hôm qua.
 *   • Ngày gần nhất cũ hơn hôm qua → 0 (chuỗi đã gãy).
 * Chịu được: mảng rỗng, ngày trùng, ngày lộn xộn (tự dedupe + sort), ngày sai
 * định dạng (bỏ qua), ngày tương lai (bỏ qua — không tin dữ liệu vượt hôm nay).
 */
export function computeDayStreak(dates: string[], today: string): number {
  const todayNum = toDayNumber(today);
  if (todayNum === null) return 0;

  const daySet = new Set<number>();
  for (const d of dates) {
    const n = toDayNumber(d);
    if (n !== null && n <= todayNum) daySet.add(n); // bỏ ngày tương lai
  }
  if (daySet.size === 0) return 0;

  const sortedDesc = [...daySet].sort((a, b) => b - a);
  const mostRecent = sortedDesc[0];

  // Chuỗi chỉ sống nếu ngày gần nhất là hôm nay (todayNum) hoặc hôm qua (-1).
  if (mostRecent < todayNum - 1) return 0;

  let streak = 1;
  let prev = mostRecent;
  for (let i = 1; i < sortedDesc.length; i++) {
    if (sortedDesc[i] === prev - 1) {
      streak++;
      prev = sortedDesc[i];
    } else {
      break; // đứt quãng → dừng đếm
    }
  }
  return streak;
}

/**
 * BẢNG THƯỞNG MỐC CHUỖI NGÀY, CỐ ĐỊNH Ở SERVER (như QUEST_REWARD). Client chỉ
 * gửi action 'streak' — KHÔNG gửi số xu/số ngày. Tặng 1 LẦN mỗi mốc.
 */
export const STREAK_MILESTONE_REWARD: Record<number, number> = {
  7: 200,
  30: 1000,
  100: 5000,
};

/** Sentinel key trong quest_claims để lưu các mốc streak đã nhận (định dạng
 *  KHÁC HẲN ngày 'YYYY-MM-DD' nên không đụng quest daily dùng chung cột). */
export const STREAK_CLAIM_KEY = '__streak_milestones__';

export interface StreakGrant {
  /** Các mốc (ngày) mới đạt mà chưa nhận thưởng. */
  milestones: number[];
  /** Tổng xu cần grant cho các mốc mới. */
  coins: number;
}

/**
 * Các mốc user ĐÃ ĐẠT (streak >= mốc) mà CHƯA nhận thưởng → tổng xu cần trao.
 * Idempotent: `claimedMilestones` (từ quest_claims sentinel) đã nhận rồi thì
 * không trả lại. Trả rỗng nếu không có mốc mới.
 */
export function pendingStreakGrant(streak: number, claimedMilestones: string[]): StreakGrant {
  const claimed = new Set(
    claimedMilestones.map((s) => Number(s)).filter((n) => Number.isInteger(n))
  );

  const milestones: number[] = [];
  let coins = 0;
  for (const key of Object.keys(STREAK_MILESTONE_REWARD)) {
    const m = Number(key);
    if (streak >= m && !claimed.has(m)) {
      milestones.push(m);
      coins += STREAK_MILESTONE_REWARD[m];
    }
  }
  return { milestones, coins };
}
