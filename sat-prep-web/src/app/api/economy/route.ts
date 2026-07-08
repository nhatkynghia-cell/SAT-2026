import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadEconomy, saveEconomy, loadPvpState, savePvpState, tryConsumePvpFightAtomic, loadQuestClaims, saveQuestClaim } from '@/lib/economy-store';
import { getMasterySummary } from '@/lib/mastery';
import { computeStats } from '@/lib/stats';
import { PVP_OPPONENTS } from '@/helpers/pvp';
import { rateLimit } from '@/lib/rate-limit';
import {
  applyQuestReward,
  applySpend,
  applySpin,
  resolvePvpFight,
  checkPvpAttempt,
  bumpPvpCounter,
  nextPvpRank,
  PVP_MAX_FIGHTS_PER_DAY,
} from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';
import { loadSnapshots, todayVN } from '@/lib/daily-snapshot-store';
import { computeDayStreak, pendingStreakGrant, STREAK_CLAIM_KEY } from '@/lib/day-streak';

/**
 * ECONOMY API (server-authoritative) — implementation_plan.md §9.1, task #2
 *
 * GET  → trạng thái kinh tế hiện tại { coins, xp, inventory, lastSpinDate }.
 * POST → thực thi 1 HÀNH ĐỘNG; server quyết phần thưởng rồi persist (HMAC).
 *   (action 'answer' ĐÃ GỠ — ROOT A: thưởng câu luyện tập nay ở /api/grade)
 *   (action 'exam'   ĐÃ GỠ — ROOT A đường thi: thi chấm ở /api/exams/grade)
 *   { action: 'quest',  questId }
 *   { action: 'spend',  amount, itemId? }
 *   { action: 'spin' }
 *   { action: 'pvp',    targetRank }
 *
 * 🔴 Client KHÔNG gửi số xu/XP. Mọi con số do server tính từ bảng thưởng cố định.
 */

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  const user = await getCurrentUser();
  const economy = await loadEconomy(user.id);
  return NextResponse.json(economy);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`economy:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await req.json();
    const action = body?.action;

    const state = await loadEconomy(user.id);
    // Hệ số nhân xu theo gói (phễu RPG) — dùng cho quest + pvp (faucet do nỗ lực).
    const coinMult = TIER_COIN_MULTIPLIER[await getUserTier(user.id)];

    // ⚠️ action 'answer' ĐÃ GỠ (ROOT A, 2026-07-04): phần thưởng 1 câu luyện tập
    // trước đây tin `isCorrect` client gửi → faucet xu (POST isCorrect:true không
    // cần trả lời vẫn cộng xu). Nay CHỈ `/api/grade` trao thưởng, dựa trên đáp án
    // lưu server + CAS answered:false→true. Client KHÔNG còn gọi action 'answer'.

    // ⚠️ action 'exam' ĐÃ GỠ (ROOT A follow-up đường thi, 2026-07-04): trước đây
    // tin `correctCount` + `difficulty` client gửi → client POST count/độ khó tùy
    // ý = faucet xu (đề còn ship đáp án xuống client để tự chấm). Nay bài thi chấm
    // SERVER-SIDE: /api/exams/start phát câu + lưu đáp án, /api/exams/grade chấm
    // từng câu (CAS) + thưởng theo độ khó THẬT. Ôn từ vựng thưởng trong /api/vocab.

    if (action === 'quest') {
      const questId = typeof body.questId === 'string' ? body.questId : '';
      const today = todayStr();
      const claimed = await loadQuestClaims(user.id, today);
      if (claimed.includes(questId)) {
        return NextResponse.json(
          { success: false, error: 'Quest đã nhận hôm nay', code: 'ALREADY_CLAIMED' },
          { status: 409 }
        );
      }
      const { state: next, granted } = applyQuestReward(state, questId, coinMult);
      if (granted.coins > 0 || granted.xp > 0) {
        await saveQuestClaim(user.id, today, questId);
      }
      await saveEconomy(user.id, next);
      return NextResponse.json({ success: true, granted, state: next });
    }

    if (action === 'streak') {
      // 🔥 Chuỗi NGÀY học liên tiếp — server-authoritative. Chuỗi DẪN XUẤT từ
      // daily_snapshots (mỗi ngày user chấm câu → 1 row server-ghi), client KHÔNG
      // gửi số ngày/số xu. Mốc 7/30/100 tặng 1 LẦN (idempotent qua quest_claims
      // sentinel STREAK_CLAIM_KEY). KHÔNG phạt gãy chuỗi (chỉ về 0, không mất xu).
      const today = todayVN();
      // Lấy đủ xa để phủ mốc 100 (110 ngày). loadSnapshots đọc từ ngày >= since.
      const since = new Date(Date.now() - 110 * 86_400_000).toISOString().slice(0, 10);
      const snaps = await loadSnapshots(user.id, since);
      const dayStreak = computeDayStreak(snaps.map((s) => s.snapshot_date), today);

      const claimedMilestones = await loadQuestClaims(user.id, STREAK_CLAIM_KEY);
      const grant = pendingStreakGrant(dayStreak, claimedMilestones);

      if (grant.coins > 0) {
        // Cộng xu mốc vào economy (server quyết số từ STREAK_MILESTONE_REWARD).
        // Xu mốc KHÔNG nhân hệ số gói (thưởng cố định — như phần XP quest).
        await saveEconomy(user.id, { ...state, coins: state.coins + grant.coins });
        // Đánh dấu từng mốc đã nhận (idempotent — lần sau pendingStreakGrant bỏ qua).
        for (const m of grant.milestones) {
          await saveQuestClaim(user.id, STREAK_CLAIM_KEY, String(m));
        }
      }

      return NextResponse.json({
        success: true,
        dayStreak,
        granted: { coins: grant.coins },
        milestonesReached: grant.milestones,
        state: grant.coins > 0 ? { ...state, coins: state.coins + grant.coins } : state,
      });
    }

    if (action === 'spend') {
      const result = applySpend(state, body.amount, body.itemId);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      await saveEconomy(user.id, result.state);
      return NextResponse.json({ success: true, state: result.state });
    }

    if (action === 'spin') {
      // Random CHẠY Ở SERVER (client không gửi kết quả).
      const result = applySpin(state, todayStr(), Math.random);
      if (result.ok) await saveEconomy(user.id, result.state);
      return NextResponse.json({
        success: result.ok,
        result: result.result,
        state: result.state,
      });
    }

    if (action === 'pvp') {
      // Trận PvP server-authoritative (nợ T7 + anti-faucet). Lực chiến = NĂNG LỰC
      // HỌC THẬT (basePower từ mastery), RNG + cổng năng lực + thưởng đều ở server.
      // 🔴 Server tự quyết targetRank từ rank THẬT (KHÔNG tin client) + cap/ngày.

      // FAIL-SAFE: nếu cột pvp_* chưa tồn tại (migration chưa chạy) → đóng PvP,
      // KHÔNG mở faucet. loadPvpState trả null đúng trường hợp này.
      const pvp = await loadPvpState(user.id);
      if (!pvp) {
        return NextResponse.json(
          { success: false, error: 'Đấu trường PvP đang được nâng cấp. Vui lòng quay lại sau!', pvpUnavailable: true },
          { status: 503 }
        );
      }

      const today = todayStr();
      // Đối thủ = hạng KẾ TRÊN theo rank THẬT ở server (bỏ qua targetRank client gửi).
      const targetRank = pvp.pvpRank - 1;

      // Cổng 1: hợp lệ hóa lượt đánh (chỉ đối thủ kế trên + cap/ngày).
      const attempt = checkPvpAttempt(pvp.pvpRank, targetRank, pvp.fightsToday, pvp.lastFightDate, today);
      if (!attempt.allowed) {
        return NextResponse.json({
          success: true,
          eligible: false,
          won: false,
          granted: { coins: 0, xp: 0 },
          pvpRank: pvp.pvpRank,
          fightsRemaining: attempt.fightsRemaining,
          reason: attempt.reason,
        });
      }

      const opponent = PVP_OPPONENTS[targetRank];
      if (!opponent) {
        // Đã ở đỉnh (rank 1 → targetRank 0): không còn đối thủ.
        return NextResponse.json({
          success: true,
          eligible: false,
          won: false,
          granted: { coins: 0, xp: 0 },
          pvpRank: pvp.pvpRank,
          fightsRemaining: attempt.fightsRemaining,
          reason: 'Bạn đã đạt đỉnh cao Thách Đấu, không còn đối thủ!',
        });
      }

      // basePower từ mastery — KHÔNG cộng equipmentBonus vào lực PvP (equipmentBonus=0).
      const summary = await getMasterySummary(user.id);
      const { basePower } = computeStats(summary, 0);

      // Cổng 2: năng lực + RNG + thưởng.
      const fight = resolvePvpFight(
        state,
        {
          basePower,
          opponentPower: opponent.luc_chien,
          rewardCoins: opponent.reward_coins,
          rewardXp: opponent.reward_xp,
        },
        Math.random,
        coinMult
      );

      // Nếu KHÔNG đủ lực (power gate fail) → KHÔNG tính là 1 trận (không tốn cap,
      // không đổi rank). Trả hướng dẫn luyện thêm.
      if (!fight.eligible) {
        return NextResponse.json({
          success: true,
          eligible: false,
          won: false,
          granted: { coins: 0, xp: 0 },
          combatPower: fight.combatPower,
          pvpRank: pvp.pvpRank,
          fightsRemaining: attempt.fightsRemaining,
          reason: fight.reason,
        });
      }

      // Đã qua cổng năng lực. TIÊU 1 suất trận ATOMIC (audit 2026-07-03, ROOT C):
      // hàm SQL khóa dòng → kiểm cap + rank tuần tự + tăng đếm + leo rank trong 1
      // transaction → chống race 10 request `pvp` đồng thời vượt cap (faucet xu).
      // FAIL-SAFE: RPC chưa có (pre-migration) → null → fallback đường non-atomic
      // cũ (0 regression tới khi user chạy atomic_mutations.sql).
      const consumed = await tryConsumePvpFightAtomic(
        user.id,
        targetRank,
        fight.won,
        today,
        PVP_MAX_FIGHTS_PER_DAY
      );

      if (consumed) {
        // ── Đường ATOMIC (authoritative) ──
        // Bị chặn do đua đồng thời (cap đầy / rank không còn tuần tự) → KHÔNG cộng xu.
        if (!consumed.ok) {
          return NextResponse.json({
            success: true,
            eligible: false,
            won: false,
            granted: { coins: 0, xp: 0 },
            combatPower: fight.combatPower,
            pvpRank: consumed.pvpRank || pvp.pvpRank,
            fightsRemaining: Math.max(0, PVP_MAX_FIGHTS_PER_DAY - consumed.fightsToday),
            reason:
              consumed.reason === 'cap'
                ? `Hôm nay bạn đã đấu đủ ${PVP_MAX_FIGHTS_PER_DAY} trận. Quay lại vào ngày mai nhé!`
                : 'Chỉ được thách đấu đối thủ kế tiếp trong bảng xếp hạng. Hãy leo tuần tự!',
          });
        }
        // Hàm SQL ĐÃ cập nhật rank + đếm trận atomic. Chỉ còn cộng xu (khi thắng).
        if (fight.won) {
          await saveEconomy(user.id, fight.state);
        }
        return NextResponse.json({
          success: true,
          eligible: true,
          won: fight.won,
          granted: fight.granted,
          combatPower: fight.combatPower,
          pvpRank: consumed.pvpRank,
          fightsRemaining: Math.max(0, PVP_MAX_FIGHTS_PER_DAY - consumed.fightsToday),
          state: fight.state,
        });
      }

      // ── FALLBACK non-atomic (pre-migration) — hành vi cũ, race vẫn hở tới khi
      // chạy SQL. Giữ y nguyên để 0 regression. ──
      const counter = bumpPvpCounter(pvp.fightsToday, pvp.lastFightDate, today);
      const newRank = nextPvpRank(pvp.pvpRank, fight.won);

      // Persist: coins TRƯỚC (chỉ khi thắng, state có đổi), rồi PvP state.
      if (fight.won) {
        await saveEconomy(user.id, fight.state);
      }
      await savePvpState(user.id, {
        pvpRank: newRank,
        fightsToday: counter.fightsToday,
        lastFightDate: counter.lastFightDate,
      });

      return NextResponse.json({
        success: true,
        eligible: true,
        won: fight.won,
        granted: fight.granted,
        combatPower: fight.combatPower,
        pvpRank: newRank,
        fightsRemaining: Math.max(0, attempt.fightsRemaining - 1),
        state: fight.state,
      });
    }

    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
  } catch (error) {
    console.error('Lỗi economy:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
