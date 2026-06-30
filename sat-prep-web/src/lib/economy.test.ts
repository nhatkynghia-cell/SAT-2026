import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAnswerReward,
  applyExamReward,
  applyQuestReward,
  applySpend,
  applySpin,
  comboMultiplier,
  resolvePvpFight,
  PVP_COMBAT_SCALE,
  PVP_MIN_POWER_RATIO,
  ANSWER_REWARD,
  QUEST_REWARD,
  DEFAULT_ECONOMY,
  SPIN_VIRTUAL_ITEMS,
  type EconomyState,
} from './economy.ts';

function fresh(): EconomyState {
  return { ...DEFAULT_ECONOMY, inventory: [] };
}

test('applyAnswerReward: trả lời SAI → không thưởng gì', () => {
  const r = applyAnswerReward(fresh(), false, 'Hard', 10);
  assert.deepEqual(r.granted, { coins: 0, xp: 0 });
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins);
});

test('applyAnswerReward: Hard đúng → thưởng theo bảng cố định server', () => {
  const r = applyAnswerReward(fresh(), true, 'Hard', 0);
  assert.equal(r.granted.coins, ANSWER_REWARD.Hard.coins);
  assert.equal(r.granted.xp, ANSWER_REWARD.Hard.xp);
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins + ANSWER_REWARD.Hard.coins);
});

test('comboMultiplier: streak >= 5 → x1.5', () => {
  assert.equal(comboMultiplier(4), 1.0);
  assert.equal(comboMultiplier(5), 1.5);
});

test('applyAnswerReward: combo áp dụng khi streak dài', () => {
  const r = applyAnswerReward(fresh(), true, 'Medium', 5);
  assert.equal(r.granted.coins, Math.floor(ANSWER_REWARD.Medium.coins * 1.5));
  assert.equal(r.granted.xp, Math.floor(ANSWER_REWARD.Medium.xp * 1.5));
});

test('applyExamReward: nhân số câu đúng với đơn giá cố định theo độ khó', () => {
  const r = applyExamReward(fresh(), 10, 'Hard');
  assert.equal(r.granted.coins, ANSWER_REWARD.Hard.coins * 10);
  assert.equal(r.granted.xp, ANSWER_REWARD.Hard.xp * 10);
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins + ANSWER_REWARD.Hard.coins * 10);
});

test('applyExamReward: 0 câu đúng (hoặc count không hợp lệ) → không thưởng', () => {
  assert.deepEqual(applyExamReward(fresh(), 0, 'Medium').granted, { coins: 0, xp: 0 });
  assert.deepEqual(applyExamReward(fresh(), -3, 'Medium').granted, { coins: 0, xp: 0 });
  assert.deepEqual(applyExamReward(fresh(), 2.5, 'Medium').granted, { coins: 0, xp: 0 });
});

test('applyExamReward: KHÔNG áp combo (combo chỉ cho chuỗi trả lời đơn lẻ)', () => {
  // Thưởng bài = đơn giá × số câu, tuyến tính, không nhân hệ số combo.
  const r = applyExamReward(fresh(), 3, 'Easy');
  assert.equal(r.granted.coins, ANSWER_REWARD.Easy.coins * 3);
  assert.equal(r.granted.xp, ANSWER_REWARD.Easy.xp * 3);
});

test('applyQuestReward: questId hợp lệ → thưởng theo bảng cố định server', () => {
  const r = applyQuestReward(fresh(), 'q3');
  assert.equal(r.granted.coins, QUEST_REWARD.q3.coins);
  assert.equal(r.granted.xp, QUEST_REWARD.q3.xp);
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins + QUEST_REWARD.q3.coins);
  assert.equal(r.state.xp, DEFAULT_ECONOMY.xp + QUEST_REWARD.q3.xp);
});

test('applyQuestReward: questId lạ → không thưởng (đóng vector bơm tùy ý)', () => {
  assert.deepEqual(applyQuestReward(fresh(), 'q999').granted, { coins: 0, xp: 0 });
  assert.deepEqual(applyQuestReward(fresh(), '').granted, { coins: 0, xp: 0 });
});

test('applySpend: đủ xu → trừ đúng, thêm item vào túi', () => {
  const s = { ...fresh(), coins: 100 };
  const r = applySpend(s, 30, 'skin_1');
  assert.equal(r.ok, true);
  assert.equal(r.state.coins, 70);
  assert.ok(r.state.inventory.includes('skin_1'));
});

test('applySpend: KHÔNG đủ xu → từ chối, state không đổi', () => {
  const s = { ...fresh(), coins: 10 };
  const r = applySpend(s, 50);
  assert.equal(r.ok, false);
  assert.equal(r.state.coins, 10);
});

test('applySpend: số tiền không hợp lệ (âm/không nguyên) → từ chối', () => {
  assert.equal(applySpend({ ...fresh(), coins: 100 }, -5).ok, false);
  assert.equal(applySpend({ ...fresh(), coins: 100 }, 3.5).ok, false);
});

test('applySpin: đã quay hôm nay → từ chối', () => {
  const s = { ...fresh(), lastSpinDate: '2026-06-27' };
  const r = applySpin(s, '2026-06-27', () => 0.5);
  assert.equal(r.ok, false);
  assert.equal(r.result.type, 'none');
});

test('applySpin: roll < 80 → thưởng xu (đồ ảo, không quà thật)', () => {
  // rng đầu = 0.1 (roll=10 → nhánh coins), rng sau = 0 → coins = 50.
  const seq = [0.1, 0];
  let i = 0;
  const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
  assert.equal(r.ok, true);
  assert.equal(r.result.type, 'coins');
  assert.equal(r.state.lastSpinDate, '2026-06-27');
});

test('applySpin: roll cao → trúng cực phẩm, item nằm trong DANH SÁCH ẢO', () => {
  // rng đầu = 0.99 (roll=99 → nhánh epic), rng sau = 0 → item đầu danh sách.
  const seq = [0.99, 0];
  let i = 0;
  const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
  assert.equal(r.result.type, 'epic');
  assert.ok(SPIN_VIRTUAL_ITEMS.includes(r.result.itemId!), 'phải là đồ ảo');
});

test('applySpin: KHÔNG có nhánh nào trao quà thật (rw_*/voucher)', () => {
  // Quét mọi roll: không item nào có tiền tố quà thật.
  for (let roll = 0; roll < 100; roll += 1) {
    const seq = [roll / 100, 0];
    let i = 0;
    const r = applySpin(fresh(), '2026-06-27', () => seq[i++]);
    if (r.result.itemId) {
      assert.ok(!r.result.itemId.startsWith('rw_'), `loot box quà thật rò rỉ: ${r.result.itemId}`);
    }
  }
});

// ─── PvP COMBAT (server-authoritative) ─────────────────────────────────────

function pvpInput(basePower: number, opponentPower: number, rewardCoins = 1000, rewardXp = 800) {
  return { basePower, opponentPower, rewardCoins, rewardXp };
}

test('resolvePvpFight: lực YẾU dưới cổng → KHÔNG đủ điều kiện, không thưởng', () => {
  // basePower 1 → combatPower 40; đối thủ 4000 → cần >= 2000. Trượt cổng.
  const r = resolvePvpFight(fresh(), pvpInput(1, 4000), () => 0);
  assert.equal(r.eligible, false);
  assert.equal(r.won, false);
  assert.deepEqual(r.granted, { coins: 0, xp: 0 });
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins, 'state không đổi khi không đủ điều kiện');
  assert.ok(r.reason && r.reason.length > 0, 'phải có lý do hướng dẫn');
});

test('resolvePvpFight: combatPower = basePower × PVP_COMBAT_SCALE', () => {
  const r = resolvePvpFight(fresh(), pvpInput(50, 120), () => 0.99);
  assert.equal(r.combatPower, 50 * PVP_COMBAT_SCALE);
});

test('resolvePvpFight: cổng đúng ngưỡng PVP_MIN_POWER_RATIO (biên)', () => {
  // Chọn opp sao cho combatPower == opp * ratio (đủ điều kiện, không trượt).
  const basePower = 25; // combatPower = 1000
  const opp = Math.floor((basePower * PVP_COMBAT_SCALE) / PVP_MIN_POWER_RATIO); // 2000
  const r = resolvePvpFight(fresh(), pvpInput(basePower, opp), () => 0); // rng=0 → chắc thắng nếu winProb>0
  assert.equal(r.eligible, true, 'đúng ngưỡng vẫn đủ điều kiện (>=)');
});

test('resolvePvpFight: đủ điều kiện + THẮNG → cộng đúng phần thưởng đối thủ', () => {
  // basePower cao → combatPower lớn → winProb cao; rng=0 → luôn thắng.
  const r = resolvePvpFight(fresh(), pvpInput(80, 300, 1200, 900), () => 0);
  assert.equal(r.eligible, true);
  assert.equal(r.won, true);
  assert.deepEqual(r.granted, { coins: 1200, xp: 900 });
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins + 1200);
  assert.equal(r.state.xp, DEFAULT_ECONOMY.xp + 900);
});

test('resolvePvpFight: đủ điều kiện nhưng THUA (rng cao) → không thưởng, state nguyên', () => {
  // combatPower 40*40=1600 vs opp 1600 → winProb 0.5; rng=0.99 → thua.
  const r = resolvePvpFight(fresh(), pvpInput(40, 1600), () => 0.99);
  assert.equal(r.eligible, true);
  assert.equal(r.won, false);
  assert.deepEqual(r.granted, { coins: 0, xp: 0 });
  assert.equal(r.state.coins, DEFAULT_ECONOMY.coins);
});

test('resolvePvpFight: lực cao hơn → xác suất thắng cao hơn (winProb tăng theo basePower)', () => {
  // Đếm số thắng trên dãy rng cố định: basePower lớn phải thắng nhiều hơn.
  const rolls = Array.from({ length: 100 }, (_, i) => i / 100);
  const countWins = (basePower: number) => {
    let wins = 0;
    for (const roll of rolls) {
      const r = resolvePvpFight(fresh(), pvpInput(basePower, 1600), () => roll);
      if (r.eligible && r.won) wins += 1;
    }
    return wins;
  };
  assert.ok(countWins(80) > countWins(40), 'basePower cao hơn → thắng nhiều hơn');
});

test('resolvePvpFight: KHÔNG ăn thưởng âm/biến dạng (reward kẹp >= 0, làm tròn xuống)', () => {
  const r = resolvePvpFight(fresh(), pvpInput(80, 300, -50, 12.9), () => 0);
  assert.deepEqual(r.granted, { coins: 0, xp: 12 });
});
