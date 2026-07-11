/**
 * INTEGRATION — /api/vocab POST (ôn từ vựng Leitner + thưởng ROOT A đường ôn).
 * Bất biến tiền: CHỈ thưởng khi từ THẬT SỰ đến hạn (isDue) VÀ bấm "đã nhớ" (1 câu
 * Easy) · ôn lại cùng từ ngay sau đó → next_review đẩy tương lai → không due →
 * KHÔNG farm được · box Leitner luôn cập nhật.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes, disableRpc } from './harness.mjs';
import { POST } from '@/app/api/vocab/route';

function seedUser(id, coins = 100) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}
function seedVocab(id, words) {
  seed('user_vocab_srs', { user_id: id, words });
}

test('vocab: từ đến hạn + đã nhớ → +5/+20 (1 câu Easy), box tăng', async () => {
  resetDb(); setCurrentUser({ id: 'v-ok' }); seedUser('v-ok');
  // next_review quá khứ → due.
  seedVocab('v-ok', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  const { status, body } = await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 5, xp: 20 });
  assert.equal(getRows('user_economy')[0].coins, 105);
  assert.equal(body.word.box, 2, 'nhớ → box 1→2');
});

test('vocab: farm chặn — ôn lại cùng từ ngay sau khi đã ôn → không due → granted 0', async () => {
  resetDb(); setCurrentUser({ id: 'v-farm' }); seedUser('v-farm');
  seedVocab('v-farm', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true }))); // +5, next_review đẩy tương lai
  assert.equal(getRows('user_economy')[0].coins, 105);

  const r2 = await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  assert.deepEqual(r2.body.granted, { coins: 0, xp: 0 }, 'không còn due → không thưởng');
  assert.equal(getRows('user_economy')[0].coins, 105, 'không farm được');
});

test('vocab: đến hạn nhưng bấm "quên" → không thưởng, box về 1', async () => {
  resetDb(); setCurrentUser({ id: 'v-forget' }); seedUser('v-forget');
  seedVocab('v-forget', [{ id: 'w1', box: 3, next_review: '2020-01-01' }]);

  const { body } = await readRes(await POST(postJson({ wordId: 'w1', isRemembered: false })));
  assert.deepEqual(body.granted, { coins: 0, xp: 0 });
  assert.equal(body.word.box, 1, 'quên → box về 1');
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('vocab: wordId không tồn tại → 404', async () => {
  resetDb(); setCurrentUser({ id: 'v-404' }); seedUser('v-404');
  seedVocab('v-404', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);
  const { status } = await readRes(await POST(postJson({ wordId: 'ghost', isRemembered: true })));
  assert.equal(status, 404);
});

// H2: ôn từ vựng NUÔI mastery rw.vocab (trước đây KHÔNG ghi → adaptive/dashboard mù).
test('vocab: từ đến hạn → GHI mastery rw.vocab (attempts tăng)', async () => {
  resetDb(); setCurrentUser({ id: 'v-mastery' }); seedUser('v-mastery');
  seedVocab('v-mastery', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  const mrow = getRows('user_mastery').find((r) => r.user_id === 'v-mastery');
  assert.ok(mrow, 'đã tạo row user_mastery');
  assert.ok(mrow.skills['rw.vocab'], 'skill rw.vocab được ghi');
  assert.equal(mrow.skills['rw.vocab'].attempts, 1, 'ôn 1 từ due → 1 attempt');
});

test('vocab: farm chặn cũng KHÔNG ghi mastery (không due → không recordAnswer)', async () => {
  resetDb(); setCurrentUser({ id: 'v-nofarm' }); seedUser('v-nofarm');
  seedVocab('v-nofarm', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true }))); // due lần 1 → ghi
  await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true }))); // không due → KHÔNG ghi
  const mrow = getRows('user_mastery').find((r) => r.user_id === 'v-nofarm');
  assert.equal(mrow.skills['rw.vocab'].attempts, 1, 'chỉ ghi lần due, spam không thổi mastery');
});

// ROOT C: thưởng ôn từ ATOMIC + idempotent theo due-instance (chống 2 POST cùng
// wordId cộng đôi). Đường atomic qua RPC claim_quest_reward (fake-db mock).
test('vocab: idempotent — cùng due-instance grant đúng 1 lần (ghi quest_claims bucket vocab)', async () => {
  resetDb(); setCurrentUser({ id: 'v-atomic' }); seedUser('v-atomic');
  seedVocab('v-atomic', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  const r1 = await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  assert.deepEqual(r1.body.granted, { coins: 5, xp: 20 });
  assert.equal(getRows('user_economy')[0].coins, 105);
  // quest_claims có bucket vocab với itemId = w1:<next_review gốc>.
  const econ = getRows('user_economy')[0];
  const bucket = econ.quest_claims?.['__vocab_reward__'];
  assert.ok(Array.isArray(bucket) && bucket.some((k) => k.startsWith('w1:')), 'ghi khóa idempotent vocab');
});

test('vocab: due-instance MỚI (next_review khác) VẪN thưởng được (không khóa vĩnh viễn)', async () => {
  resetDb(); setCurrentUser({ id: 'v-next' }); seedUser('v-next');
  // 2 từ khác nhau, cả hai đều due → mỗi từ 1 due-instance riêng → cả hai thưởng.
  seedVocab('v-next', [
    { id: 'w1', box: 1, next_review: '2020-01-01' },
    { id: 'w2', box: 1, next_review: '2020-01-02' },
  ]);
  await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  await readRes(await POST(postJson({ wordId: 'w2', isRemembered: true })));
  assert.equal(getRows('user_economy')[0].coins, 110, '2 từ due khác nhau → +5 +5');
});

test('vocab: đường FALLBACK (RPC chưa migrate) vẫn thưởng đúng 1 lần', async () => {
  resetDb(); setCurrentUser({ id: 'v-fb' }); seedUser('v-fb');
  disableRpc('claim_quest_reward'); // ép PGRST202 → route fallback non-atomic
  seedVocab('v-fb', [{ id: 'w1', box: 1, next_review: '2020-01-01' }]);

  const r = await readRes(await POST(postJson({ wordId: 'w1', isRemembered: true })));
  assert.deepEqual(r.body.granted, { coins: 5, xp: 20 }, 'fallback vẫn cấp đúng');
  assert.equal(getRows('user_economy')[0].coins, 105);
});
