import { getCycleKey, type SeasonCycle } from './season';

/**
 * ============================================================================
 *  TRẢ LỜI NHANH (Speed Quiz) — logic THUẦN (no I/O, unit-test được)
 * ============================================================================
 *  Chứa: mốc thưởng trong lượt, bậc thưởng cuối kỳ theo hạng, và xác định các
 *  chu kỳ VỪA KẾT THÚC tại một thời điểm (cho cron chốt thưởng). Tách khỏi store
 *  I/O để test xác định (nhận `now` qua tham số như season.ts).
 * ============================================================================
 */

/** Mốc thưởng trong 1 lượt (số câu đúng → xu). Nhận 1 lần/ngày/mốc (idempotent server). */
export interface Milestone {
  correct: number;
  coins: number;
}

export const SPEED_QUIZ_MILESTONES: readonly Milestone[] = [
  { correct: 10, coins: 100 },
  { correct: 20, coins: 250 },
  { correct: 30, coins: 500 },
];

/** Các mốc đã ĐẠT với correctCount cho trước (để claim). correctCount do SERVER đếm. */
export function milestonesReached(correctCount: number): Milestone[] {
  return SPEED_QUIZ_MILESTONES.filter((m) => correctCount >= m.correct);
}

/**
 * Bậc thưởng CUỐI KỲ theo hạng (Pha 4). Mỗi cycle có các ngưỡng hạng: đứng trong
 * top `maxRank` nhận `coins`. Lấy phần thưởng CAO NHẤT mà hạng của user thỏa.
 * Giá trị ví dụ — chỉnh tự do; càng dài kỳ thưởng càng lớn (giữ động lực).
 */
export interface RewardTier {
  maxRank: number;
  coins: number;
}

export const CYCLE_REWARD_TIERS: Record<SeasonCycle, readonly RewardTier[]> = {
  day: [
    { maxRank: 1, coins: 500 },
    { maxRank: 3, coins: 300 },
    { maxRank: 10, coins: 100 },
  ],
  week: [
    { maxRank: 1, coins: 2000 },
    { maxRank: 3, coins: 1000 },
    { maxRank: 10, coins: 500 },
  ],
  month: [
    { maxRank: 1, coins: 8000 },
    { maxRank: 3, coins: 4000 },
    { maxRank: 10, coins: 2000 },
  ],
  year: [
    { maxRank: 1, coins: 50000 },
    { maxRank: 3, coins: 25000 },
    { maxRank: 10, coins: 10000 },
  ],
};

/** Xu thưởng cuối kỳ cho `rank` (1-based) ở `cycle`. 0 nếu ngoài mọi ngưỡng. */
export function rewardForRank(cycle: SeasonCycle, rank: number): number {
  if (!Number.isInteger(rank) || rank < 1) return 0;
  // Tiers sắp theo maxRank tăng dần → ngưỡng đầu tiên mà rank thỏa là thưởng cao nhất.
  for (const tier of CYCLE_REWARD_TIERS[cycle]) {
    if (rank <= tier.maxRank) return tier.coins;
  }
  return 0;
}

/** Số hạng tối đa còn được thưởng ở một cycle (để giới hạn số user cần chốt). */
export function maxRewardedRank(cycle: SeasonCycle): number {
  const tiers = CYCLE_REWARD_TIERS[cycle];
  return tiers.reduce((mx, t) => Math.max(mx, t.maxRank), 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_CYCLES: SeasonCycle[] = ['day', 'week', 'month', 'year'];

/**
 * Các chu kỳ VỪA KẾT THÚC tại `now` (cho cron chạy ~00:00 VN mỗi ngày).
 * Nguyên tắc: chu kỳ T vừa kết thúc ⟺ key của T tại `now` KHÁC key của T tại
 * `now - 24h` (VN cố định UTC+7, không DST). Khi khác → chu kỳ trước đã đóng và
 * key cần chốt = key của T tại `now - 24h`.
 *   • day  → luôn đổi mỗi ngày → luôn chốt "hôm qua".
 *   • week → chỉ đổi khi `now` là thứ Hai VN → chốt tuần trước.
 *   • month→ chỉ đổi khi `now` là ngày 1 VN → chốt tháng trước.
 *   • year → chỉ đổi khi `now` là 1/1 VN → chốt năm trước.
 * Idempotent ở tầng RPC nên chạy lại an toàn; ngày bị bỏ lỡ (cron miss) sẽ không
 * được truy chốt — chấp nhận (thưởng là phụ, app chưa deploy khi viết).
 */
export function cyclesEndingAt(now: Date): Array<{ cycle: SeasonCycle; key: string }> {
  const prev = new Date(now.getTime() - DAY_MS);
  const result: Array<{ cycle: SeasonCycle; key: string }> = [];
  for (const cycle of ALL_CYCLES) {
    if (getCycleKey(now, cycle) !== getCycleKey(prev, cycle)) {
      result.push({ cycle, key: getCycleKey(prev, cycle) });
    }
  }
  return result;
}
