/**
 * ============================================================================
 *  LEADERBOARD (pure) — xếp hạng theo NĂNG LỰC HỌC THẬT (basePower)
 * ============================================================================
 *  THUẦN (no I/O). Tầng store (leaderboard-store.ts) lo đọc user_profiles +
 *  user_mastery qua service-role rồi tính basePower (computeStats) → truyền
 *  mảng vào đây để xếp hạng. Tách để unit-test xác định.
 *
 *  🔴 PRIVACY: entry ra ngoài CHỈ gồm nickname + basePower + rank + isMe. KHÔNG
 *  serialize userId (dùng nội bộ để đánh dấu isMe rồi bỏ). Xếp theo basePower
 *  (mastery học thật) → khớp anti-pay-to-win: không mua/cày vô nghĩa để leo.
 * ============================================================================
 */

/** Khung viền danh vọng (THUẦN TRANG TRÍ — KHÔNG đổi thứ hạng). */
export interface FrameCosmetic {
  icon?: string;
  cssClass?: string;
  label?: string;
}

export interface RankRow {
  /** Nội bộ — để đánh dấu isMe, KHÔNG lộ ra client. */
  userId: string;
  nickname: string;
  basePower: number;
  /**
   * Mức CẢI THIỆN trong kỳ (delta điểm/mastery, tuần) — cho bảng xếp theo TIẾN BỘ
   * (RPG 60/40: người mới cũng có cửa top khi tiến bộ nhanh). Optional; vắng → 0.
   */
  deltaPower?: number;
  /** Khung viền danh vọng (theo tier) — trang trí, KHÔNG dùng để sắp xếp. */
  frame?: FrameCosmetic;
  /** Danh hiệu danh vọng (theo tier) — trang trí, KHÔNG dùng để sắp xếp. */
  title?: string;
}

export interface LeaderboardEntry {
  rank: number; // 1-based
  nickname: string;
  basePower: number;
  /** Delta cải thiện trong kỳ (chỉ có ở bảng xếp theo tiến bộ). */
  deltaPower?: number;
  isMe: boolean;
  /** Khung viền danh vọng — CHỈ render, KHÔNG ảnh hưởng rank/basePower. */
  frame?: FrameCosmetic;
  /** Danh hiệu danh vọng — CHỈ render cạnh nickname, KHÔNG ảnh hưởng rank. */
  title?: string;
}

export interface RankedResult {
  top: LeaderboardEntry[];
  /** Vị trí của mình — kể cả khi ngoài topN. null nếu mình không có trong rows. */
  me: LeaderboardEntry | null;
}

/**
 * Xếp hạng: giảm dần theo basePower; tie-break nickname A→Z (deterministic để
 * rank ổn định giữa các lần query). Gán rank 1-based. Cắt topN. Tìm rank của
 * myUserId kể cả khi ngoài topN.
 */
export function rankEntries(rows: RankRow[], myUserId: string, topN: number): RankedResult {
  const sorted = [...rows].sort((a, b) => {
    if (b.basePower !== a.basePower) return b.basePower - a.basePower;
    return a.nickname.localeCompare(b.nickname);
  });

  const ranked: Array<LeaderboardEntry & { userId: string }> = sorted.map((r, i) => ({
    userId: r.userId,
    rank: i + 1,
    nickname: r.nickname,
    basePower: r.basePower,
    isMe: r.userId === myUserId,
    // frame/title chỉ đi theo để RENDER — KHÔNG tham gia sort (comparator ở trên
    // chỉ dùng basePower + nickname). Chống pay-to-win: danh vọng không đổi hạng.
    frame: r.frame,
    title: r.title,
  }));

  const limit = Number.isInteger(topN) && topN > 0 ? topN : 0;
  // Bỏ userId khi trả ra ngoài (privacy).
  const top: LeaderboardEntry[] = ranked.slice(0, limit).map(({ userId: _uid, ...e }) => e);

  const mineFull = ranked.find((e) => e.userId === myUserId);
  const me: LeaderboardEntry | null = mineFull
    ? {
        rank: mineFull.rank,
        nickname: mineFull.nickname,
        basePower: mineFull.basePower,
        isMe: true,
        frame: mineFull.frame,
        title: mineFull.title,
      }
    : null;

  return { top, me };
}

/**
 * BẢNG XẾP THEO TIẾN BỘ (delta) — song song bảng power tuyệt đối (RPG 60/40:
 * người mới/cải thiện nhanh có cửa top, so sánh xã hội lành mạnh). Xếp giảm dần
 * theo deltaPower; tie-break basePower rồi nickname. deltaPower vắng → 0.
 *
 * 🔴 KHÔNG dùng cosmetic (frame/title) để sắp xếp (giữ anti-pay-to-win). Trả
 * LeaderboardEntry kèm deltaPower cho UI hiện "+X tuần này".
 */
export function rankByDelta(rows: RankRow[], myUserId: string, topN: number): RankedResult {
  const deltaOf = (r: RankRow) => (typeof r.deltaPower === 'number' ? r.deltaPower : 0);
  const sorted = [...rows].sort((a, b) => {
    const da = deltaOf(a);
    const db = deltaOf(b);
    if (db !== da) return db - da;
    if (b.basePower !== a.basePower) return b.basePower - a.basePower;
    return a.nickname.localeCompare(b.nickname);
  });

  const ranked: Array<LeaderboardEntry & { userId: string }> = sorted.map((r, i) => ({
    userId: r.userId,
    rank: i + 1,
    nickname: r.nickname,
    basePower: r.basePower,
    deltaPower: deltaOf(r),
    isMe: r.userId === myUserId,
    frame: r.frame,
    title: r.title,
  }));

  const limit = Number.isInteger(topN) && topN > 0 ? topN : 0;
  const top: LeaderboardEntry[] = ranked.slice(0, limit).map(({ userId: _uid, ...e }) => e);

  const mineFull = ranked.find((e) => e.userId === myUserId);
  const me: LeaderboardEntry | null = mineFull
    ? {
        rank: mineFull.rank,
        nickname: mineFull.nickname,
        basePower: mineFull.basePower,
        deltaPower: mineFull.deltaPower,
        isMe: true,
        frame: mineFull.frame,
        title: mineFull.title,
      }
    : null;

  return { top, me };
}
