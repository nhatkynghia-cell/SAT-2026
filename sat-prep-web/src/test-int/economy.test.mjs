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

/**
 * Seed N câu ĐÚNG đã chấm HÔM NAY cho user (cho quest 'learning contract'
 * answer-correct). created_at = now (nằm trong ngày VN hôm nay). Dùng để quest
 * q1/q1b/q1c qua cổng completion server-side.
 */
function seedCorrectAnswersToday(userId, n) {
  const nowIso = new Date().toISOString();
  for (let i = 0; i < n; i++) {
    seed('issued_questions', {
      user_id: userId,
      answered: true,
      was_correct: true,
      skill_id: 'algebra.linear_eq',
      context: null,
      created_at: nowIso,
    });
  }
}

/**
 * Seed counter hoạt động hôm nay (VN) cho quest 'vocab-reviewed'/'exam-completed'.
 * kind = 'vocab_review' | 'exam_complete'. Ngày VN = UTC+7 (khớp todayVN()).
 */
function seedActivityToday(userId, kind, count) {
  const dayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  seed('user_daily_activity', { user_id: userId, activity_date: dayVN, kind, count });
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

test('economy GET/POST: chưa đăng nhập → 401, KHÔNG đụng ví mặc định', async () => {
  resetDb(); setCurrentUser(null);
  const get = await readRes(await GET());
  assert.equal(get.status, 401);
  const post = await readRes(await POST(postJson({ action: 'dailyLogin' })));
  assert.equal(post.status, 401);
  assert.equal(getRows('user_economy').length, 0);
});

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

test('economy quest: q1 (answer-correct) đủ câu đúng hôm nay → +10/+50 server-quyết, ghi claim', async () => {
  resetDb(); setCurrentUser({ id: 'e-q1' }); seedUser('e-q1');
  seedCorrectAnswersToday('e-q1', 5); // q1 target 5
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q1' })));
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 10, xp: 50 });
  assert.equal(getRows('user_economy')[0].coins, 110);
});

test('economy quest: q1 CHƯA đủ câu đúng hôm nay → 403 QUEST_NOT_COMPLETE, KHÔNG cấp thưởng', async () => {
  resetDb(); setCurrentUser({ id: 'e-q1-nope' }); seedUser('e-q1-nope');
  seedCorrectAnswersToday('e-q1-nope', 2); // < target 5 → chưa hoàn thành
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q1' })));
  assert.equal(status, 403);
  assert.equal(body.code, 'QUEST_NOT_COMPLETE');
  assert.equal(getRows('user_economy')[0].coins, 100, 'không cấp thưởng khi chưa hoàn thành');
});

test('economy quest: double-claim cùng ngày → 409, không cộng lần 2', async () => {
  resetDb(); setCurrentUser({ id: 'e-qdup' }); seedUser('e-qdup');
  seedActivityToday('e-qdup', 'exam_complete', 1); // q3 target 1 → đủ hoàn thành
  await readRes(await POST(postJson({ action: 'quest', questId: 'q3' }))); // +100
  assert.equal(getRows('user_economy')[0].coins, 200);
  const r2 = await readRes(await POST(postJson({ action: 'quest', questId: 'q3' })));
  assert.equal(r2.status, 409);
  assert.equal(getRows('user_economy')[0].coins, 200, 'không cộng lần 2');
});

test('economy quest: q2 (vocab-reviewed) đủ từ ôn hôm nay → cấp thưởng', async () => {
  resetDb(); setCurrentUser({ id: 'e-q2' }); seedUser('e-q2');
  seedActivityToday('e-q2', 'vocab_review', 10); // q2 target 10
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q2' })));
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 20, xp: 100 });
  assert.equal(getRows('user_economy')[0].coins, 120);
});

test('economy quest: q2 CHƯA đủ từ ôn → 403 QUEST_NOT_COMPLETE', async () => {
  resetDb(); setCurrentUser({ id: 'e-q2-nope' }); seedUser('e-q2-nope');
  seedActivityToday('e-q2-nope', 'vocab_review', 3); // < target 10
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q2' })));
  assert.equal(status, 403);
  assert.equal(body.code, 'QUEST_NOT_COMPLETE');
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('economy quest: q3 (exam-completed) chưa thi xong → 403', async () => {
  resetDb(); setCurrentUser({ id: 'e-q3-nope' }); seedUser('e-q3-nope');
  // KHÔNG seed activity → count=0 < target 1 → chưa hoàn thành.
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q3' })));
  assert.equal(status, 403);
  assert.equal(body.code, 'QUEST_NOT_COMPLETE');
  assert.equal(getRows('user_economy')[0].coins, 100);
});

// ── CHỐNG FAUCET MULTI-VARIANT (khóa claim theo TRACK) ───────────────────────
// Mỗi track có 3 biến thể cùng reward+metric (q3/q3b/q3c). Trước fix, claim cả 3
// = 3× thưởng trên 1 hoạt động. Sau fix (questClaimKey → 'qtrack:exam'): biến thể
// thứ 2 trở đi trong CÙNG track → 409, KHÔNG cấp lần 2.
test('economy quest: claim q3 rồi q3b (cùng track exam) → q3b 409, KHÔNG cấp 3× thưởng', async () => {
  resetDb(); setCurrentUser({ id: 'e-multivar' }); seedUser('e-multivar');
  seedActivityToday('e-multivar', 'exam_complete', 1); // đủ hoàn thành cho MỌI biến thể exam

  const r1 = await readRes(await POST(postJson({ action: 'quest', questId: 'q3' })));
  assert.equal(r1.status, 200);
  assert.equal(getRows('user_economy')[0].coins, 200); // +100

  // q3b: khác questId nhưng CÙNG track → claimKey 'qtrack:exam' đã nhận → 409.
  const r2 = await readRes(await POST(postJson({ action: 'quest', questId: 'q3b' })));
  assert.equal(r2.status, 409, 'biến thể cùng track đã nhận → 409');
  assert.equal(getRows('user_economy')[0].coins, 200, 'KHÔNG cấp lần 2');

  // q3c: cũng cùng track → 409.
  const r3 = await readRes(await POST(postJson({ action: 'quest', questId: 'q3c' })));
  assert.equal(r3.status, 409);
  assert.equal(getRows('user_economy')[0].coins, 200, 'tổng vẫn chỉ +100 cho 1 track/ngày');
});

test('economy quest: track KHÁC nhau vẫn nhận độc lập (answer vs exam không đụng nhau)', async () => {
  resetDb(); setCurrentUser({ id: 'e-multitrack' }); seedUser('e-multitrack');
  seedCorrectAnswersToday('e-multitrack', 5);          // q1 answer target 5
  seedActivityToday('e-multitrack', 'exam_complete', 1); // q3 exam target 1

  const rA = await readRes(await POST(postJson({ action: 'quest', questId: 'q1' })));
  assert.equal(rA.status, 200);
  const rB = await readRes(await POST(postJson({ action: 'quest', questId: 'q3' })));
  assert.equal(rB.status, 200, 'track khác → nhận độc lập');
  // 100 + 10 (q1) + 100 (q3) = 210.
  assert.equal(getRows('user_economy')[0].coins, 210);
});

test('economy quest: q2 bảng activity CHƯA migrate → FAIL-OPEN (cấp thưởng như cũ)', async () => {
  resetDb(); setCurrentUser({ id: 'e-q2-premig' }); seedUser('e-q2-premig');
  // KHÔNG seed user_daily_activity + đánh dấu bảng thiếu → countDailyActivity trả null
  // → metricValue undefined → checkQuestCompletion 'unknown' → fail-open (cấp).
  markMissingColumns('user_daily_activity', ['count']);
  const { status, body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q2' })));
  assert.equal(status, 200, 'pre-migration → fail-open, không chặn');
  assert.deepEqual(body.granted, { coins: 20, xp: 100 });
});

test('economy quest: questId lạ → granted 0 (không bơm tùy ý)', async () => {
  resetDb(); setCurrentUser({ id: 'e-qbad' }); seedUser('e-qbad');
  const { body } = await readRes(await POST(postJson({ action: 'quest', questId: 'q999' })));
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('economy spend: đúng giá catalog → trừ đúng + thêm item; overdraw → 400', async () => {
  resetDb(); setCurrentUser({ id: 'e-spend' }); seedUser('e-spend', { coins: 2000 });
  // skin_1 giá niêm yết 1500 — amount PHẢI khớp giá catalog (server chống client gửi amount rẻ).
  const ok = await readRes(await POST(postJson({ action: 'spend', amount: 1500, itemId: 'skin_1' })));
  assert.equal(ok.status, 200);
  assert.equal(getRows('user_economy')[0].coins, 500);
  assert.deepEqual(getRows('user_economy')[0].inventory, ['skin_1']);

  const over = await readRes(await POST(postJson({ action: 'spend', amount: 999999, itemId: 'skin_2' })));
  assert.equal(over.status, 400);
  assert.equal(getRows('user_economy')[0].coins, 500, 'overdraw không trừ');
});

test('economy spend: amount KHÔNG khớp giá catalog → 400 (chống gửi giá rẻ)', async () => {
  resetDb(); setCurrentUser({ id: 'e-spend2' }); seedUser('e-spend2', { coins: 2000 });
  // skin_1 giá 1500 nhưng client gửi 120 → server từ chối, không trừ, không thêm item.
  const bad = await readRes(await POST(postJson({ action: 'spend', amount: 120, itemId: 'skin_1' })));
  assert.equal(bad.status, 400);
  assert.equal(getRows('user_economy')[0].coins, 2000, 'giá sai không trừ');
  assert.deepEqual(getRows('user_economy')[0].inventory ?? [], [], 'giá sai không thêm item');
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
  // Route economy đếm lượt PvP theo NGÀY VN (todayVN, UTC+7) — seed phải khớp giờ
  // VN, KHÔNG dùng UTC date. Trong cửa sổ 00:00–07:00 VN, UTC date là "hôm qua" →
  // route reset lượt → cap không chặn → test flaky (fail đúng khoảng giờ đó).
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
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
