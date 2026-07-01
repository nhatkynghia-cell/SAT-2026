import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadEconomy, saveEconomy, loadPvpState, savePvpState } from '@/lib/economy-store';
import { getMasterySummary } from '@/lib/mastery';
import { computeStats } from '@/lib/stats';
import { PVP_OPPONENTS } from '@/helpers/pvp';
import {
  applyAnswerReward,
  applyExamReward,
  applyQuestReward,
  applySpend,
  applySpin,
  resolvePvpFight,
  checkPvpAttempt,
  bumpPvpCounter,
  nextPvpRank,
  type Difficulty,
} from '@/lib/economy';

/**
 * ECONOMY API (server-authoritative) — implementation_plan.md §9.1, task #2
 *
 * GET  → trạng thái kinh tế hiện tại { coins, xp, inventory, lastSpinDate }.
 * POST → thực thi 1 HÀNH ĐỘNG; server quyết phần thưởng rồi persist (HMAC).
 *   { action: 'answer', isCorrect, difficulty, streak }
 *   { action: 'exam',   correctCount, difficulty }
 *   { action: 'quest',  questId }
 *   { action: 'spend',  amount, itemId? }
 *   { action: 'spin' }
 *   { action: 'pvp',    targetRank }
 *
 * 🔴 Client KHÔNG gửi số xu/XP. Mọi con số do server tính từ bảng thưởng cố định.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

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
    const body = await req.json();
    const action = body?.action;

    const state = await loadEconomy(user.id);

    if (action === 'answer') {
      const difficulty: Difficulty = VALID_DIFFICULTY.includes(body.difficulty)
        ? body.difficulty
        : 'Medium';
      const streak = Number.isInteger(body.streak) && body.streak >= 0 ? body.streak : 0;
      const { state: next, granted } = applyAnswerReward(state, !!body.isCorrect, difficulty, streak);
      await saveEconomy(user.id, next);
      return NextResponse.json({ success: true, granted, state: next });
    }

    if (action === 'exam') {
      // Phần thưởng cho 1 BÀI (thi thử/thi thật): server nhân SỐ CÂU ĐÚNG với
      // đơn giá cố định theo độ khó. Client chỉ gửi correctCount + difficulty,
      // KHÔNG gửi số xu/XP → không thể bơm tùy ý (§9.1).
      const difficulty: Difficulty = VALID_DIFFICULTY.includes(body.difficulty)
        ? body.difficulty
        : 'Medium';
      const { state: next, granted } = applyExamReward(state, body.correctCount, difficulty);
      await saveEconomy(user.id, next);
      return NextResponse.json({ success: true, granted, state: next });
    }

    if (action === 'quest') {
      // Phần thưởng NHẬN nhiệm vụ: server tra QUEST_REWARD theo questId.
      // Client chỉ gửi questId, KHÔNG gửi số xu/XP (trước đây client tự gửi
      // q.xp/q.coins từ state client → bơm tùy ý). questId lạ → 0 (§9.1).
      const questId = typeof body.questId === 'string' ? body.questId : '';
      const { state: next, granted } = applyQuestReward(state, questId);
      await saveEconomy(user.id, next);
      return NextResponse.json({ success: true, granted, state: next });
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
        Math.random
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

      // Đã đánh 1 trận hợp lệ (thắng hoặc thua): tính vào cap, cập nhật rank.
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
