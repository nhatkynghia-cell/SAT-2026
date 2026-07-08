/**
 * ============================================================================
 *  RPG RULES (pure) — logic gamification tách khỏi React/IO để unit-test.
 * ============================================================================
 *  Cùng triết lý economy.ts: hàm THUẦN, không I/O, không React. Context
 *  (GamificationContext) + BadgeSystem import lại module này.
 *
 *  ⚠️ ĐÂY KHÔNG PHẢI money-core. Badge/streak-shield/quest-rollover/maxPower ở
 *  đây là HIỂN THỊ + COSMETIC:
 *    • maxPower là "lực chiến" trưng bày (badge Lực Chiến, tiêu đề trang chủ,
 *      sát thương boss thuần hiệu ứng). KHÔNG bơm lực PvP — resolvePvpFight
 *      (economy.ts) ép equipmentBonus=0, lực PvP CHỈ từ mastery học thật.
 *    • shield chỉ cứu chuỗi combo (combo tối đa ×1.5 và chỉ nhân trên câu THẬT
 *      đúng, đã CAS ở /api/grade) — không phải vector tiền.
 *    • Số xu/XP THẬT vẫn do server quyết (/api/grade, /api/economy). Client chỉ
 *      trừ optimistic rồi đồng bộ lại số dư từ server.
 * ============================================================================
 */

// ── BADGE ─────────────────────────────────────────────────────────────────
// NGUỒN DUY NHẤT cho badge. Trước đây bị NHÂN ĐÔI: BADGE_CATALOG (context, 8
// thẻ có check) và mảng BADGES (BadgeSystem.tsx, 15 thẻ tĩnh) với ID TRÙNG
// KHÁC NGHĨA — vd c_1 vừa là "Tích 500 Xu" (context) vừa là "Diệt 10 Boss"
// (BadgeSystem) → đạt 500 xu thắp SAI thẻ, thẻ đúng không có check nên tắt vĩnh
// viễn. Nay chỉ giữ badge CHẤM ĐƯỢC từ state thật (level/maxPower/coins); bỏ
// badge dựa trên bộ đếm KHÔNG được theo dõi (diệt boss, chuỗi ngày) để không
// hứa suông. Badge là DẪN XUẤT (không persist) nên đổi catalog an toàn.

export type BadgeCategory = 'Tu Vi' | 'Lực Chiến' | 'Chiến Tích';

export interface BadgeState {
  level: number;
  maxPower: number;
  coins: number;
}

export interface BadgeDef {
  id: string;
  title: string;
  req_desc: string;
  icon: string;
  category: BadgeCategory;
  check: (state: BadgeState) => boolean;
}

export const BADGE_CATALOG: BadgeDef[] = [
  // Tu Vi — theo THANG KỸ NĂNG (level = số skill tinh thông + 1, §10).
  { id: 'b_1', title: 'Tân Binh Xuất Thế', req_desc: 'Tinh thông 1 kỹ năng', icon: '🥉', category: 'Tu Vi', check: (s) => s.level >= 2 },
  { id: 'b_2', title: 'Kiếm Khách SAT', req_desc: 'Tinh thông 3 kỹ năng', icon: '🗡️', category: 'Tu Vi', check: (s) => s.level >= 4 },
  { id: 'b_3', title: 'Đại Pháp Sư SAT', req_desc: 'Tinh thông 6 kỹ năng', icon: '🧙‍♂️', category: 'Tu Vi', check: (s) => s.level >= 7 },
  { id: 'b_4', title: 'Đỉnh Phong Thủ Khoa', req_desc: 'Tinh thông 10 kỹ năng', icon: '👑', category: 'Tu Vi', check: (s) => s.level >= 11 },
  { id: 'b_5', title: 'Thần Thoại Học Thuật', req_desc: 'Tinh thông 14 kỹ năng', icon: '🌟', category: 'Tu Vi', check: (s) => s.level >= 15 },

  // Lực Chiến — theo maxPower (cosmetic; ngưỡng chọn để đạt được qua trang bị +
  // cường hóa, không phải tường vĩnh viễn).
  { id: 'l_1', title: 'Sức Mạnh Đánh Thức', req_desc: 'Cần 100 Lực chiến', icon: '🔥', category: 'Lực Chiến', check: (s) => s.maxPower >= 100 },
  { id: 'l_2', title: 'Kẻ Phá Vỡ Giới Hạn', req_desc: 'Cần 250 Lực chiến', icon: '⚔️', category: 'Lực Chiến', check: (s) => s.maxPower >= 250 },
  { id: 'l_3', title: 'Đòn Đánh Chí Mạng', req_desc: 'Cần 500 Lực chiến', icon: '💥', category: 'Lực Chiến', check: (s) => s.maxPower >= 500 },
  { id: 'l_4', title: 'Chiến Thần Hủy Diệt', req_desc: 'Cần 800 Lực chiến', icon: '🌋', category: 'Lực Chiến', check: (s) => s.maxPower >= 800 },
  { id: 'l_5', title: 'Chúa Tể Sức Mạnh', req_desc: 'Cần 1200 Lực chiến', icon: '⚡', category: 'Lực Chiến', check: (s) => s.maxPower >= 1200 },

  // Chiến Tích — theo xu TÍCH LŨY (coins hiện tại; mốc cày cuốc).
  { id: 'c_1', title: 'Phú Hộ Học Thuật', req_desc: 'Tích lũy 500 Xu', icon: '💰', category: 'Chiến Tích', check: (s) => s.coins >= 500 },
  { id: 'c_2', title: 'Đại Gia Tri Thức', req_desc: 'Tích lũy 2.000 Xu', icon: '💎', category: 'Chiến Tích', check: (s) => s.coins >= 2000 },
  { id: 'c_3', title: 'Thương Nhân Huyền Thoại', req_desc: 'Tích lũy 5.000 Xu', icon: '🏦', category: 'Chiến Tích', check: (s) => s.coins >= 5000 },
  { id: 'c_4', title: 'Chúa Tể Kho Báu', req_desc: 'Tích lũy 10.000 Xu', icon: '👑', category: 'Chiến Tích', check: (s) => s.coins >= 10000 },
];

/** Danh sách ID badge đang mở, dẫn xuất từ state (thuần — dùng cho useMemo). */
export function computeUnlockedBadges(state: BadgeState): string[] {
  return BADGE_CATALOG.filter((b) => b.check(state)).map((b) => b.id);
}

// ── STREAK / SHIELD ─────────────────────────────────────────────────────────
// Khi trả lời SAI: nếu còn Khiên Bảo Vệ Streak (shield_1, mua 50 xu ở shop) →
// TIÊU 1 khiên và GIỮ nguyên chuỗi. Hết khiên → chuỗi về 0. Trước đây
// registerGradedResult reset streak=0 VÔ ĐIỀU KIỆN → khiên mua về KHÔNG BAO GIỜ
// tiêu (đồ chết, mất niềm tin).

export interface StreakShieldResult {
  streak: number;
  shield: number;
  shieldUsed: boolean;
}

export function resolveStreakOnWrong(streak: number, shield: number): StreakShieldResult {
  if (Number.isInteger(shield) && shield > 0) {
    return { streak, shield: shield - 1, shieldUsed: true };
  }
  return { streak: 0, shield: Math.max(0, shield | 0), shieldUsed: false };
}

// ── DAILY QUEST ROLLOVER ────────────────────────────────────────────────────
// Reset nhiệm vụ ngày khi qua ngày mới. Trước đây quests lưu client KHÔNG có dấu
// ngày → progress/claimed đứng im VĨNH VIỄN sau ngày 1 (server đã scope claim
// theo ngày qua saveQuestClaim, nhưng UI client không bao giờ mở lại quest cho
// ngày mới). Trả daily đã reset (progress 0, claimed false) nếu savedDate !=
// today; giữ nguyên name/target/thưởng. Số xu/XP claim vẫn do server tra
// QUEST_REWARD (§9.1) — reset chỉ mở lại nút, không tự cộng tiền.

export interface QuestLike {
  id: string;
  progress: number;
  claimed?: boolean;
  [k: string]: unknown;
}

export function rolloverDailyQuests<T extends QuestLike>(
  daily: T[],
  savedDate: string | null | undefined,
  today: string
): { daily: T[]; changed: boolean } {
  if (savedDate === today) return { daily, changed: false };
  const reset = daily.map((q) => ({ ...q, progress: 0, claimed: false }));
  return { daily: reset, changed: true };
}

// ── SHOP / EQUIPMENT ────────────────────────────────────────────────────────
// Bonus maxPower (cosmetic — xem cảnh báo đầu file) cho trang bị mua ở shop.
// Trước đây buyItem chỉ cộng maxPower khi id chứa "power" (KHÔNG id nào trong
// ITEM_CATALOG khớp) → equipment 5.000-6.000 xu mua về HOÀN TOÀN vô dụng. Nay
// mỗi món equipment cộng maxPower cố định (~price/20). Skin thuần thẩm mỹ (0).

export const EQUIPMENT_POWER: Record<string, number> = {
  eq_epic_1: 40, // Găng Tay Tri Thức (800 xu)
  eq_epic_2: 45, // Mũ Cú Vọ Ban Đêm (850 xu)
  eq_leg_1: 250, // Huy Hiệu Ivy League (5.000 xu)
  eq_leg_2: 300, // Nhẫn Chân Lý SAT (6.000 xu)
};

export type BuyReason = 'insufficient' | 'already_owned';

export interface BuyDecision {
  ok: boolean;
  reason?: BuyReason;
  /** maxPower cộng thêm (cosmetic). */
  maxPowerDelta: number;
  /** shield counter cộng thêm (consumable Khiên Bảo Vệ Streak). */
  shieldDelta: number;
}

/**
 * Quyết định mua 1 item (thuần). Kiểm số dư + CHỐNG MUA TRÙNG đồ vĩnh viễn:
 * equipment/skin cộng maxPower MỘT LẦN — mua lại sẽ bơm ảo (đúng lỗi equipPet
 * cũ cộng dồn +50 mỗi lần đổi). Consumable (shield/mana/heal/skip/exp) vẫn mua
 * lặp được. Việc TRỪ XU THẬT do server làm (/api/economy 'spend'); ở đây chỉ
 * kiểm optimistic để phản hồi UI.
 */
export function resolveBuy(
  item: { id: string; type: string; price: number },
  coins: number,
  owned: string[]
): BuyDecision {
  if (coins < item.price) {
    return { ok: false, reason: 'insufficient', maxPowerDelta: 0, shieldDelta: 0 };
  }

  const isPermanent = item.type === 'equipment' || item.type === 'skin';
  if (isPermanent && owned.includes(item.id)) {
    return { ok: false, reason: 'already_owned', maxPowerDelta: 0, shieldDelta: 0 };
  }

  return {
    ok: true,
    maxPowerDelta: EQUIPMENT_POWER[item.id] ?? 0,
    shieldDelta: item.id.includes('shield') ? 1 : 0,
  };
}
