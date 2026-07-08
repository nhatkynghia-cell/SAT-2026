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

export interface RankRow {
  /** Nội bộ — để đánh dấu isMe, KHÔNG lộ ra client. */
  userId: string;
  nickname: string;
  basePower: number;
}

export interface LeaderboardEntry {
  rank: number; // 1-based
  nickname: string;
  basePower: number;
  isMe: boolean;
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
  }));

  const limit = Number.isInteger(topN) && topN > 0 ? topN : 0;
  // Bỏ userId khi trả ra ngoài (privacy).
  const top: LeaderboardEntry[] = ranked.slice(0, limit).map(({ userId: _uid, ...e }) => e);

  const mineFull = ranked.find((e) => e.userId === myUserId);
  const me: LeaderboardEntry | null = mineFull
    ? { rank: mineFull.rank, nickname: mineFull.nickname, basePower: mineFull.basePower, isMe: true }
    : null;

  return { top, me };
}
