/**
 * ============================================================================
 *  ECONOMY CORE (server-authoritative) — implementation_plan.md §9.1, task #2
 * ============================================================================
 *  🔴 ĐÂY LÀ LÕI CHỐNG GIAN LẬN. Nguyên tắc: client gửi HÀNH ĐỘNG ("trả lời
 *  đúng", "mua", "quay"), SERVER quyết phần thưởng. Số xu/XP thưởng lấy từ
 *  REWARD SCHEDULE cố định ở server — client KHÔNG được gửi số tiền tùy ý.
 *
 *  Vì sao trọng yếu: xu đổi được quà THẬT (§9.6). Trước đây mọi tính toán nằm
 *  ở client (GamificationContext) và server ký HMAC lên bất kỳ số nào client
 *  gửi → ai cũng tự cộng xu. Module này đảo ngược điều đó.
 *
 *  QUYẾT ĐỊNH ĐÃ CHỐT (§10):
 *    • KHÔNG còn Level phẳng — tiến trình do Skill Tree (task #17). Economy chỉ
 *      giữ xu (tiền tệ) + XP (điểm tích lũy) + túi đồ ảo.
 *    • Vòng quay CHỈ trao đồ ẢO (skin/đá cường hóa/xu) — KHÔNG quà thật qua
 *      cơ chế ngẫu nhiên (tránh loot box). Quà thật đổi bằng xu theo cách xác định.
 *
 *  ⚠️ THUẦN (pure) — không I/O. Random + "hôm nay" được TIÊM vào (dependency
 *  injection) để unit-test xác định được. Tầng I/O + HMAC nằm ở economy-store.ts.
 * ============================================================================
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface EconomyState {
  coins: number;
  xp: number;
  inventory: string[];   // id vật phẩm ẢO đã sở hữu
  lastSpinDate: string | null;
}

export const DEFAULT_ECONOMY: EconomyState = {
  coins: 100,
  xp: 0,
  inventory: [],
  lastSpinDate: null,
};

/**
 * BẢNG THƯỞNG CỐ ĐỊNH Ở SERVER cho mỗi câu trả lời đúng, theo độ khó.
 * Client KHÔNG được phép gửi số thưởng — chỉ gửi "đúng/sai" + độ khó.
 */
export const ANSWER_REWARD: Record<Difficulty, { coins: number; xp: number }> = {
  Easy: { coins: 5, xp: 20 },
  Medium: { coins: 10, xp: 50 },
  Hard: { coins: 20, xp: 100 },
};

/** Hệ số combo khi chuỗi đúng dài (server tự tính, client không gửi). */
export function comboMultiplier(streak: number): number {
  return streak >= 5 ? 1.5 : 1.0;
}

export interface RewardResult {
  state: EconomyState;
  granted: { coins: number; xp: number };
}

/**
 * Áp phần thưởng cho 1 câu trả lời. Server quyết số xu/XP từ ANSWER_REWARD.
 * streak dùng để tính combo (cũng do server giữ, không tin client).
 */
export function applyAnswerReward(
  state: EconomyState,
  isCorrect: boolean,
  difficulty: Difficulty,
  streak = 0
): RewardResult {
  if (!isCorrect) return { state, granted: { coins: 0, xp: 0 } };

  const base = ANSWER_REWARD[difficulty];
  const mult = comboMultiplier(streak);
  const coins = Math.floor(base.coins * mult);
  const xp = Math.floor(base.xp * mult);

  return {
    state: { ...state, coins: state.coins + coins, xp: state.xp + xp },
    granted: { coins, xp },
  };
}

/**
 * Phần thưởng cho 1 BÀI (thi thử / thi thật / lượt ôn từ vựng): server nhân
 * SỐ CÂU ĐÚNG với đơn giá CỐ ĐỊNH theo độ khó (lấy lại từ ANSWER_REWARD).
 * Client chỉ gửi SỐ ĐẾM + độ khó — KHÔNG gửi số xu/XP → không thể bơm tùy ý.
 */
export function applyExamReward(
  state: EconomyState,
  correctCount: number,
  difficulty: Difficulty
): RewardResult {
  const count = Number.isInteger(correctCount) && correctCount > 0 ? correctCount : 0;
  if (count === 0) return { state, granted: { coins: 0, xp: 0 } };

  const rate = ANSWER_REWARD[difficulty];
  const coins = rate.coins * count;
  const xp = rate.xp * count;

  return {
    state: { ...state, coins: state.coins + coins, xp: state.xp + xp },
    granted: { coins, xp },
  };
}

export interface SpendResult {
  ok: boolean;
  state: EconomyState;
  error?: string;
}

/** Trừ xu (mua hàng). Server kiểm tra số dư — client không tự trừ. */
export function applySpend(state: EconomyState, amount: number, itemId?: string): SpendResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, state, error: 'Số xu không hợp lệ' };
  }
  if (state.coins < amount) {
    return { ok: false, state, error: 'Không đủ xu' };
  }
  const next: EconomyState = { ...state, coins: state.coins - amount };
  if (itemId) next.inventory = [...state.inventory, itemId];
  return { ok: true, state: next };
}

/** Phần thưởng ẢO của vòng quay (KHÔNG có quà thật — §9.6). */
export const SPIN_VIRTUAL_ITEMS = ['skin_1', 'skin_2', 'skin_3', 'eq_epic_1', 'eq_epic_2'];

export interface SpinResult {
  ok: boolean;
  state: EconomyState;
  result: {
    type: 'coins' | 'item' | 'epic' | 'none';
    message: string;
    coins?: number;
    itemId?: string;
  };
}

/**
 * Vòng quay may mắn — CHẠY Ở SERVER. rng() trả [0,1). Chỉ trao đồ ẢO.
 * Giới hạn 1 lượt/ngày (so theo `today` server cấp, không tin client).
 */
export function applySpin(state: EconomyState, today: string, rng: () => number): SpinResult {
  if (state.lastSpinDate === today) {
    return {
      ok: false,
      state,
      result: { type: 'none', message: 'Hôm nay bạn đã quay rồi. Quay lại vào ngày mai nhé!' },
    };
  }

  const spun: EconomyState = { ...state, lastSpinDate: today };
  const roll = rng() * 100;

  if (roll < 80) {
    const coins = Math.floor(rng() * 151) + 50; // 50..200
    return {
      ok: true,
      state: { ...spun, coins: spun.coins + coins },
      result: { type: 'coins', coins, message: `Thần tài gõ cửa! Nhận ${coins} Xu!` },
    };
  } else if (roll < 95) {
    return {
      ok: true,
      state: { ...spun, inventory: [...spun.inventory, 'da_cuong_hoa'] },
      result: { type: 'item', itemId: 'da_cuong_hoa', message: 'Nhận được 1 Đá Cường Hóa Lò Rèn!' },
    };
  } else {
    const idx = Math.floor(rng() * SPIN_VIRTUAL_ITEMS.length);
    const itemId = SPIN_VIRTUAL_ITEMS[idx];
    return {
      ok: true,
      state: { ...spun, inventory: [...spun.inventory, itemId] },
      result: { type: 'epic', itemId, message: `BÙNG NỔ! Trúng cực phẩm: ${itemId}!` },
    };
  }
}
