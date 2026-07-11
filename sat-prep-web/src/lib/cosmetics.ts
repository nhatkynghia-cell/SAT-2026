import type { AiTier } from './ai-quota';

/**
 * ============================================================================
 *  COSMETICS (pure) — thẩm mỹ + danh vọng, KHÔNG ảnh hưởng sức mạnh
 * ============================================================================
 *  🛡️ CHỐNG PAY-TO-WIN (app vị thành niên): MỌI thứ ở đây THUẦN THẨM MỸ.
 *    • skin/theme: MUA được bằng xu (có `price`), gate theo `requiredTier` — chỉ
 *      mở KHÓA HIỂN THỊ (skin động, chủ đề màu), KHÔNG cộng maxPower/lực chiến.
 *    • frame/title: THƯỞNG DANH VỌNG (KHÔNG `price`, KHÔNG bán) — gán theo tier
 *      hoặc top giải đấu. Khung viền + danh hiệu chỉ để KHOE, TUYỆT ĐỐI KHÔNG đổi
 *      thứ hạng leaderboard (comparator vẫn xếp theo basePower từ mastery học thật).
 *  Không món nào ở đây là `equipment` (EQUIPMENT_POWER trong rpg-rules.ts) — cosmetic
 *  không bao giờ chạm vector sức mạnh. Đây là điểm kiểm soát: nếu cần thêm quyền lợi
 *  trả phí, thêm ở đây dưới dạng thẩm mỹ, KHÔNG dưới dạng chỉ số.
 *
 *  ⚠️ THUẦN (pure) — không I/O, không React. `now` (ISO string) được TIÊM vào các
 *  hàm dẫn xuất mùa để unit-test xác định (theo mẫu season.ts / economy.ts).
 * ============================================================================
 */

/** Độ dài một mùa danh vọng: 90 ngày (user chốt). Mùa DERIVE TỪ NGÀY, không bảng seasons. */
export const SEASON_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Key mùa 90 ngày, dẫn xuất TẤT ĐỊNH từ mốc thời gian (KHÔNG dùng Date.now bên
 * trong — `nowISO` tiêm vào). Chia số ngày kể từ epoch UTC cho 90 → chỉ số mùa
 * liên tục (theo triết lý cycle key của speed-quiz/season.ts: không cần scheduler,
 * sang mùa mới thì key đổi, bảng "tươi" mà không xoá state). Vd 'S123'.
 */
export function seasonKey(nowISO: string): string {
  const ms = new Date(nowISO).getTime();
  if (!Number.isFinite(ms)) return 'S0';
  const dayIndex = Math.floor(ms / DAY_MS);
  const seasonIndex = Math.floor(dayIndex / SEASON_DAYS);
  return `S${seasonIndex}`;
}

/** Loại cosmetic. skin/theme = MUA được; frame/title = thưởng danh vọng. */
export type CosmeticKind = 'skin' | 'theme' | 'frame' | 'title';

/**
 * Cách một cosmetic THƯỞNG (frame/title, không có price) thuộc về user:
 *  • 'tier'   — QUYỀN LỢI GÓI: tự-sở-hữu khi đủ requiredTier (không cần persist).
 *               vd Khung/Danh hiệu Ultimate, Danh hiệu Premium.
 *  • 'earned' — KIẾM ĐƯỢC: chỉ có qua GRANT persist ở bảng user_cosmetics (server-
 *               authoritative, ROOT A). vd Khung/Danh hiệu Nhà Vô Địch Mùa (top-3
 *               giải đấu Ultimate). KHÔNG tier nào tự có — phải thắng giải mới được.
 * skin/theme (có price) là hàng MUA → KHÔNG gắn grant (đã persist qua inventory).
 */
export type CosmeticGrant = 'tier' | 'earned';

export interface CosmeticItem {
  id: string;
  name: string;
  icon: string;
  kind: CosmeticKind;
  /** Gói tối thiểu để dùng/mua món này (chống mở khoá thẩm mỹ cho free). */
  requiredTier: 'premium' | 'ultimate';
  /**
   * CHỈ áp cho frame/title (hàng thưởng). Quyết định cách xác lập ownership:
   * 'tier' = auto theo gói; 'earned' = phải grant persist. Xem CosmeticGrant.
   */
  grant?: CosmeticGrant;
  /** Nếu set: món gắn với một mùa cụ thể (danh vọng theo mùa). Vắng = vĩnh viễn. */
  season?: string;
  /** Class Tailwind cho hiệu ứng hiển thị (mẫu effectClass trong ITEM_CATALOG). */
  cssClass?: string;
  /** CHỈ skin/theme có giá (mua bằng xu). frame/title KHÔNG có price (không bán). */
  price?: number;
}

/**
 * Danh mục cosmetic. skin/theme là hàng MUA (gate tier); frame/title là hàng
 * THƯỞNG (gán khi đạt tier hoặc top giải đấu — B1b/B2 cấp qua ownership, không bán).
 * Đa số Ultimate để giữ tính độc quyền của gói cao nhất; 1 skin Premium làm mồi.
 */
export const COSMETIC_CATALOG: CosmeticItem[] = [
  // ── SKIN (mua bằng xu, gate tier) ──────────────────────────────────────────
  {
    id: 'cskin_dragon',
    name: 'Long Bào Học Giả',
    icon: '🐉',
    kind: 'skin',
    requiredTier: 'ultimate',
    price: 4500,
    cssClass: 'shadow-[0_0_30px_#f59e0b] animate-pulse text-amber-300 border-[#f59e0b]',
  },
  {
    id: 'cskin_galaxy',
    name: 'Tinh Vân Trí Tuệ',
    icon: '🌌',
    kind: 'skin',
    requiredTier: 'ultimate',
    price: 5200,
    cssClass: 'shadow-[0_0_30px_#6366f1] animate-pulse text-indigo-300 border-[#6366f1]',
  },
  {
    id: 'cskin_ember',
    name: 'Tàn Hỏa Kiên Trì',
    icon: '🔥',
    kind: 'skin',
    requiredTier: 'premium',
    price: 2200,
    cssClass: 'shadow-[0_0_20px_#ef4444] text-red-300 border-[#ef4444]',
  },

  // ── THEME (mua bằng xu, gate tier) ──────────────────────────────────────────
  {
    id: 'ctheme_aurora',
    name: 'Chủ Đề Cực Quang',
    icon: '🌠',
    kind: 'theme',
    requiredTier: 'ultimate',
    price: 3800,
    cssClass: 'bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#1e1b4b]',
  },
  {
    id: 'ctheme_midnight',
    name: 'Chủ Đề Nửa Đêm Vàng',
    icon: '🌙',
    kind: 'theme',
    requiredTier: 'ultimate',
    price: 3200,
    cssClass: 'bg-gradient-to-br from-[#020617] via-[#1e293b] to-[#422006]',
  },

  // ── FRAME (thưởng danh vọng — KHÔNG price, KHÔNG bán) ───────────────────────
  // grant:'tier' = tự có khi đủ gói; grant:'earned' = phải grant persist (thắng giải).
  {
    id: 'cframe_ultimate',
    name: 'Khung Học Giả Ultimate',
    icon: '🖼️',
    kind: 'frame',
    requiredTier: 'ultimate',
    grant: 'tier', // QUYỀN LỢI GÓI: mọi user Ultimate tự có.
    cssClass: 'ring-2 ring-amber-400 shadow-[0_0_20px_#fbbf24]',
  },
  {
    id: 'cframe_champion',
    name: 'Khung Nhà Vô Địch Mùa',
    icon: '🏆',
    kind: 'frame',
    requiredTier: 'ultimate',
    // KIẾM ĐƯỢC: chỉ top-3 giải đấu Ultimate mỗi tháng mới được cấp (cron settle
    // → grantCosmetics → bảng user_cosmetics). KHÔNG gắn `season` ở đây (đó là bug
    // đông cứng lúc load-module + `new Date()` cấm trong file thuần) — món VĨNH VIỄN,
    // mùa thắng lưu ở CỘT season_key của dòng ownership. Xem [[sat-prep-adaptive]].
    grant: 'earned',
    cssClass: 'ring-2 ring-yellow-300 shadow-[0_0_28px_#fde047] animate-pulse',
  },

  // ── TITLE (thưởng danh vọng — KHÔNG price, KHÔNG bán) ────────────────────────
  {
    id: 'ctitle_ultimate',
    name: 'Học Giả Ultimate',
    icon: '🎓',
    kind: 'title',
    requiredTier: 'ultimate',
    grant: 'tier', // QUYỀN LỢI GÓI.
    cssClass: 'text-amber-300 font-black',
  },
  {
    id: 'ctitle_champion',
    name: 'Nhà Vô Địch Mùa',
    icon: '👑',
    kind: 'title',
    requiredTier: 'ultimate',
    grant: 'earned', // KIẾM ĐƯỢC (top-3 giải đấu tháng). VĨNH VIỄN, không gắn season.
    cssClass: 'text-yellow-200 font-black drop-shadow-[0_0_8px_#fde047]',
  },
  {
    id: 'ctitle_premium',
    name: 'Chiến Binh Premium',
    icon: '⭐',
    kind: 'title',
    requiredTier: 'premium',
    grant: 'tier', // QUYỀN LỢI GÓI.
    cssClass: 'text-sky-300 font-bold',
  },
];

const _byId = new Map<string, CosmeticItem>(COSMETIC_CATALOG.map((c) => [c.id, c]));

/** Tra 1 cosmetic theo id. undefined nếu không có. */
export function cosmeticById(id: string): CosmeticItem | undefined {
  return _byId.get(id);
}

/** Thứ hạng gói để so sánh điều kiện (free < premium < ultimate). */
function tierRank(tier: AiTier | 'premium' | 'ultimate'): number {
  if (tier === 'ultimate') return 2;
  if (tier === 'premium') return 1;
  return 0;
}

/**
 * Điểm ưu tiên chọn cosmetic "tốt nhất": Ultimate hơn Premium; món KIẾM ĐƯỢC
 * (grant:'earned' — danh hiệu vô địch) đè lên mọi món tier-perk (danh vọng đỉnh,
 * phải thắng giải mới có); món đúng MÙA HIỆN TẠI (danh vọng tươi) cộng cao; món mùa
 * cũ (đã sở hữu) thấp hơn; món vĩnh viễn (không mùa) ở giữa. Tất định theo nowISO.
 */
function prestigeScore(item: CosmeticItem, currentSeason: string): number {
  let score = tierRank(item.requiredTier) * 100;
  if (item.grant === 'earned') {
    score += 1000; // KIẾM ĐƯỢC (vô địch) — nổi hơn mọi quyền lợi gói.
  } else if (item.season) {
    score += item.season === currentSeason ? 1000 : 10; // mùa hiện tại >> mùa cũ
  } else {
    score += 100; // vĩnh viễn: hơn mùa cũ, kém mùa hiện tại/earned
  }
  return score;
}

/**
 * Chọn cosmetic `kind` TỐT NHẤT mà user ĐƯỢC DÙNG: phải (1) đủ tier và (2) đang
 * SỞ HỮU (ownedIds). Ưu tiên theo prestigeScore, hoà thì lấy món xuất hiện SAU
 * trong catalog (mới/xịn hơn). null nếu không có món hợp lệ. `nowISO` tiêm vào để
 * xác định mùa hiện tại (tất định, test được).
 */
function bestOfKind(
  kind: CosmeticKind,
  tier: AiTier,
  ownedIds: string[],
  nowISO: string
): CosmeticItem | null {
  const currentSeason = seasonKey(nowISO);
  const owned = new Set(ownedIds);
  const uTier = tierRank(tier);
  let best: CosmeticItem | null = null;
  let bestScore = -1;
  COSMETIC_CATALOG.forEach((item) => {
    if (item.kind !== kind) return;
    if (uTier < tierRank(item.requiredTier)) return; // chưa đủ gói
    if (!owned.has(item.id)) return; // chưa sở hữu (thưởng/mua)
    const s = prestigeScore(item, currentSeason);
    if (s >= bestScore) {
      // >= để hoà thì món xuất hiện SAU (index lớn hơn) thắng.
      bestScore = s;
      best = item;
    }
  });
  return best;
}

/** Khung viền TỐT NHẤT user được dùng (theo tier + đang sở hữu). null nếu không có. */
export function bestFrameFor(tier: AiTier, ownedIds: string[], nowISO: string): CosmeticItem | null {
  return bestOfKind('frame', tier, ownedIds, nowISO);
}

/** Danh hiệu TỐT NHẤT user được dùng (theo tier + đang sở hữu). null nếu không có. */
export function bestTitleFor(tier: AiTier, ownedIds: string[], nowISO: string): CosmeticItem | null {
  return bestOfKind('title', tier, ownedIds, nowISO);
}

/**
 * Id các cosmetic THƯỞNG kiểu 'earned' (chỉ có qua grant persist — vd khung/danh
 * hiệu vô địch). Dùng để cron biết cấp món nào cho top-3 giải đấu, và để tách khỏi
 * tier-perk khi dựng ownedIds thật. Hằng dẫn xuất từ catalog (nguồn chân lý duy nhất).
 */
export const EARNED_COSMETIC_IDS: string[] = COSMETIC_CATALOG.filter(
  (c) => c.grant === 'earned'
).map((c) => c.id);

/**
 * Id cosmetic THƯỞNG kiểu 'tier' mà `tier` này ĐỦ điều kiện tự-sở-hữu (quyền lợi
 * gói — không cần persist). Dùng dựng `ownedIds` thật: hợp với id 'earned' đã persist.
 * free → []. Chỉ trả frame/title tier-perk; skin/theme (mua) KHÔNG ở đây.
 */
export function tierPerkCosmeticIds(tier: AiTier): string[] {
  const uTier = tierRank(tier);
  return COSMETIC_CATALOG.filter(
    (c) => c.grant === 'tier' && uTier >= tierRank(c.requiredTier)
  ).map((c) => c.id);
}
