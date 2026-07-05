/**
 * INTEGRATION — /api/economy (quest / spend / spin / pvp) + GET.
 * Bất biến tiền: action 'answer'/'exam' ĐÃ GỠ (→400); quest chống double-claim;
 * spend kiểm số dư; spin server-RNG 1 lượt/ngày; PvP fail-safe khi chưa migration
 * + cổng năng lực khóa account mastery 0 (không faucet). Client KHÔNG gửi số xu.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, markMissingColumns, postJson, readRes } from './harness.mjs';
import { GET, POST } from '@/app/api/economy/route';

function seedUser(id, patch = {}) {
  seed('user_economy', {
    user_id: id, coins: 100, xp: 0, inventory: [], last_spin_date: null,
    quest_claims: {}, ...patch,
  });
}

/** Seed mastery đủ cao để qua cổng năng lực PvP (basePower lớn). */
function seedStrongMastery(id) {
  seed('user_mastery', {
    user_id: id,
    skills: {
      'algebra.linear_eq': { score: 100, attempts: 20, correct: 20, lastSeen: '2026-07-01' },
      'advanced.quadratic': { score: 100, attempts: 20, correct: 20, lastSeen: '2026-07-01' },
      'geo.circles': { score: 100, attempts: 20, correct: 20, lastSeen: '2026-07-01' },
    },
  });
}

/** Chạy fn với Math.random bị ghim (win: ()=>0, lose: ()=>1), luôn restore. */
async function withRng(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  try { return await fn(); } finally { Math.random = orig; }
}

test('economy GET: trả trạng thái hiện tại', async () => {
  resetDb(); setCurrentUser({ id: 'e-get' }); seedUser('e-get', { coins: 250, xp: 40 });
  const { status, body } = await readRes(await GET());
  assert.equal(status, 200);
  assert.equal(body.coins, 250);
  assert.equal(body.xp, 40);
});

test("economy: action 'answer' ĐÃ GỠ → 400 (đóng faucet cũ)", async () => {
  resetDb(); setCurrentUser({ id: 'e-answer' }); seedUser('e-answer');
  const { status } = await readRes(await POST(postJson({ action: 'answer', isCorrect: true, difficulty: 'Hard' })));
  assert.equal(status, 400);
  assert.equal(getRows('user_economy')[0].coins, 100, 'không cộng xu qua faucet');
});

test("economy: action 'exam' ĐÃ GỠ → 400", async () => {
  resetDb(); setCurrentUser({ id: 'e-exam' }); seedUser('e-exam');
  const { status } = await readRes(await POST(postJson({ action: 'exam', correctCount: 50, difficulty: 'Hard' })));
  assert.equal(status, 400);
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('economy quest: q1 → +10/+50 server-quyết, ghi claim', async () => {
  resetDb(); setCurrentUser({ id: 'e-q1' }); seedUser('e-q1');
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q1' })));
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 10, xp: 50 });
  assert.equal(getRows('user_economy')[0].coins, 110);
});

test('economy quest: double-claim cùng ngày → 409, không cộng lần 2', async () => {
  resetDb(); setCurrentUser({ id: 'e-qdup' }); seedUser('e-qdup');
  await readRes(await POST(postJson({ action: 'quest', questId: 'q3' }))); // +100
  assert.equal(getRows('user_economy')[0].coins, 200);
  const r2 = await readRes(await POST(postJson({ action: 'quest', questId: 'q3' })));
  assert.equal(r2.status, 409);
  assert.equal(getRows('user_economy')[0].coins, 200, 'không cộng lần 2');
});

test('economy quest: questId lạ → granted 0 (không bơm tùy ý)', async () => {
  resetDb(); setCurrentUser({ id: 'e-qbad' }); seedUser('e-qbad');
  const { body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q999' })));
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('economy spend: đủ xu → trừ đúng + thêm item; overdraw → 400', async () => {
  resetDb(); setCurrentUser({ id: 'e-spend' }); seedUser('e-spend', { coins: 300 });
  const ok = await readRes(await POST(postJson({ action: 'spend', amount: 120, itemId: 'skin_1' })));
  assert.equal(ok.status, 200);
  assert.equal(getRows('user_economy')[0].coins, 180);
  assert.deepEqual(getRows('user_economy')[0].inventory, ['skin_1']);

  const over = await readRes(await POST(postJson({ action: 'spend', amount: 999999 })));
  assert.equal(over.status, 400);
  assert.equal(getRows('user_economy')[0].coins, 180, 'overdraw không trừ');
});

test('economy spin: quay được 1 lần → set lastSpinDate; quay lại cùng ngày → không thưởng', async () => {
  resetDb(); setCurrentUser({ id: 'e-spin' }); seedUser('e-spin', { coins: 100 });
  const r1 = await readRes(await POST(postJson({ action: 'spin' })));
  assert.equal(r1.status, 200);
  assert.equal(r1.body.success, true);
  const dateAfter = getRows('user_economy')[0].last_spin_date;
  assert.ok(dateAfter, 'đã set lastSpinDate');

  const r2 = await readRes(await POST(postJson({ action: 'spin' })));
  assert.equal(r2.body.success, false, 'đã quay hôm nay');
});

test('economy pvp: cột pvp_* CHƯA có (migration chưa chạy) → 503 fail-safe, KHÔNG faucet', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-nomig' });
  seed('user_economy', { user_id: 'e-pvp-nomig', coins: 100, xp: 0, inventory: [], last_spin_date: null });
  // Migration pvp chưa chạy: select cột pvp_* → 42703 → loadPvpState trả null → route 503.
  markMissingColumns('user_economy', ['pvp_rank', 'pvp_fights_today', 'pvp_last_fight_date']);
  const { status, body } = await readRes(await POST(postJson({ action: 'pvp', targetRank: 1 })));
  assert.equal(status, 503);
  assert.equal(body.pvpUnavailable, true);
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('economy pvp: mastery 0 → cổng năng lực chặn (eligible:false), KHÔNG cộng xu', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-weak' });
  seed('user_economy', {
    user_id: 'e-pvp-weak', coins: 100, xp: 0, inventory: [], last_spin_date: null,
    pvp_rank: 11, pvp_fights_today: 0, pvp_last_fight_date: '',
  });
  // KHÔNG seed mastery → basePower 0 → combatPower 0 < opponent → power gate fail.
  const { status, body } = await readRes(await POST(postJson({ action: 'pvp', targetRank: 10 })));
  assert.equal(status, 200);
  assert.equal(body.eligible, false, 'chưa đủ lực (mastery 0)');
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100, 'không faucet');
});

test('economy pvp WIN-PATH: mastery cao + thắng → cộng ĐÚNG reward đối thủ rank kế, leo rank, +1 trận', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-win' });
  seedUser('e-pvp-win', { coins: 100, pvp_rank: 11, pvp_fights_today: 0, pvp_last_fight_date: '' });
  seedStrongMastery('e-pvp-win');

  // rng=0 → luôn thắng (won = 0 < winProb). Đối thủ rank 10 = +300 xu / +200 XP.
  const { status, body } = await withRng(0, async () =>
    readRes(await POST(postJson({ action: 'pvp', targetRank: 10 })))
  );
  assert.equal(status, 200);
  assert.equal(body.eligible, true);
  assert.equal(body.won, true);
  assert.deepEqual(body.granted, { coins: 300, xp: 200 }, 'ĐÚNG reward đối thủ rank 10');
  assert.equal(getRows('user_economy')[0].coins, 400, '100 + 300');
  const econ = getRows('user_economy')[0];
  assert.equal(econ.pvp_rank, 10, 'thắng → leo rank 11→10');
  assert.equal(econ.pvp_fights_today, 1, 'tiêu 1 suất trận');
});

test('economy pvp: THUA → giữ rank, KHÔNG cộng xu, vẫn tiêu 1 suất trận', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-lose' });
  seedUser('e-pvp-lose', { coins: 100, pvp_rank: 11, pvp_fights_today: 0, pvp_last_fight_date: '' });
  seedStrongMastery('e-pvp-lose');

  // rng=1 → luôn thua (won = 1 < winProb là false).
  const { body } = await withRng(1, async () =>
    readRes(await POST(postJson({ action: 'pvp', targetRank: 10 })))
  );
  assert.equal(body.eligible, true);
  assert.equal(body.won, false);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100, 'thua → không cộng xu');
  assert.equal(getRows('user_economy')[0].pvp_rank, 11, 'thua → giữ rank');
});

test('economy pvp CAP: đã đấu đủ 10 trận hôm nay → chặn, KHÔNG cộng xu (anti-faucet)', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-cap' });
  const today = new Date().toISOString().split('T')[0];
  seedUser('e-pvp-cap', { coins: 100, pvp_rank: 11, pvp_fights_today: 10, pvp_last_fight_date: today });
  seedStrongMastery('e-pvp-cap');

  const { body } = await withRng(0, async () =>
    readRes(await POST(postJson({ action: 'pvp', targetRank: 10 })))
  );
  assert.equal(body.eligible, false, 'hết lượt → không đủ điều kiện');
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100, 'cap chặn faucet');
});

test('economy pvp: client targetRank BỊ BỎ QUA — server dùng pvpRank-1 (không nhảy rank ăn jackpot)', async () => {
  resetDb(); setCurrentUser({ id: 'e-pvp-skip' });
  // User đang rank 11. Kẻ tấn công gửi targetRank:1 (đối thủ 15000 xu).
  seedUser('e-pvp-skip', { coins: 100, pvp_rank: 11, pvp_fights_today: 0, pvp_last_fight_date: '' });
  seedStrongMastery('e-pvp-skip');

  const { body } = await withRng(0, async () =>
    readRes(await POST(postJson({ action: 'pvp', targetRank: 1 })))
  );
  // Server bỏ qua targetRank:1, đánh rank 10 (11-1) → reward 300 chứ KHÔNG phải 15000.
  assert.equal(body.won, true);
  assert.equal(body.granted.coins, 300, 'server dùng rank kế (300), KHÔNG phải jackpot rank 1 (15000)');
  assert.notEqual(body.granted.coins, 15000);
});

test('economy: action không hợp lệ → 400', async () => {
  resetDb(); setCurrentUser({ id: 'e-bad' }); seedUser('e-bad');
  const { status } = await readRes(await POST(postJson({ action: 'teleport' })));
  assert.equal(status, 400);
});
