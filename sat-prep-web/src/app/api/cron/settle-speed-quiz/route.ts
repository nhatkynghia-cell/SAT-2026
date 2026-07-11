import { NextRequest, NextResponse } from 'next/server';
import { cyclesEndingAt, rewardForRank, maxRewardedRank } from '@/lib/speed-quiz';
import { rankUsersForCycleKey } from '@/lib/speed-quiz-leaderboard-store';
import { settleReward } from '@/lib/speed-quiz-store';
import { grantCosmetics } from '@/lib/cosmetics-store';
import { EARNED_COSMETIC_IDS } from '@/lib/cosmetics';

/**
 * CRON — chốt thưởng CUỐI KỲ theo thứ hạng (Pha 4).
 *
 * Chạy 1 lần/ngày (~00:00 VN, khai trong vercel.json). Tự xác định các chu kỳ VỪA
 * KẾT THÚC tại thời điểm chạy (cyclesEndingAt): ngày luôn; tuần nếu là thứ Hai VN;
 * tháng nếu ngày 1 VN; năm nếu 1/1 VN. Với mỗi kỳ đóng → xếp hạng top-N kỳ đó →
 * cộng xu theo bậc (rewardForRank). RPC settle idempotent nên chạy lại/nhiều lần
 * KHÔNG phát trùng.
 *
 * 🔒 Bảo vệ bằng CRON_SECRET (header Authorization: Bearer). Vercel Cron tự gắn
 * header này khi env CRON_SECRET được đặt. Sai/thiếu secret → 401.
 *
 * FAIL-SAFE: pre-migration (bảng/RPC chưa có) → rankUsersForCycleKey/settleReward
 * trả null → bỏ qua kỳ đó, KHÔNG crash, KHÔNG phát xu.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('settle-speed-quiz cron: thiếu env CRON_SECRET → từ chối (fail-closed).');
    return NextResponse.json({ error: 'CRON_SECRET chưa cấu hình' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const ending = cyclesEndingAt(now);
  const summary: Array<{ cycle: string; key: string; settled: number; champions: number; skipped: boolean }> = [];

  for (const { cycle, key } of ending) {
    const ranked = await rankUsersForCycleKey(cycle, key, maxRewardedRank(cycle));
    if (ranked === null) {
      // pre-migration / lỗi đọc → bỏ qua kỳ này (không phát).
      summary.push({ cycle, key, settled: 0, champions: 0, skipped: true });
      continue;
    }

    let settled = 0;
    for (const u of ranked) {
      const coins = rewardForRank(cycle, u.rank);
      if (coins <= 0) continue;
      const ok = await settleReward(u.userId, cycle, key, u.rank, coins);
      if (ok === null) break; // RPC biến mất giữa chừng → dừng an toàn
      if (ok) settled++;
    }

    // ── CHAMPION: top-3 GIẢI ĐẤU ULTIMATE mỗi THÁNG được cấp khung + danh hiệu Nhà
    //    Vô Địch Mùa (cosmetic 'earned', VĨNH VIỄN). Chỉ chu kỳ 'month' (user chốt).
    //    Bảng riêng ultimate-only (rankUsersForCycleKey bracket='ultimate') — KHÁC
    //    bảng cộng xu ở trên (mọi tier). grantCosmetics idempotent (PK 3 cột) nên
    //    cron chạy lại cùng mùa không nhân đôi. Fail-safe: null/false → bỏ qua.
    let champions = 0;
    if (cycle === 'month') {
      const tourneyTop = await rankUsersForCycleKey('month', key, 3, 'ultimate');
      if (tourneyTop) {
        for (const u of tourneyTop) {
          const granted = await grantCosmetics(u.userId, EARNED_COSMETIC_IDS, key);
          if (granted) champions++;
        }
      }
    }

    summary.push({ cycle, key, settled, champions, skipped: false });
  }

  return NextResponse.json({ ok: true, ranAt: now.toISOString(), cycles: summary });
}
