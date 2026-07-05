/**
 * INTEGRATION — /api/vocab POST (ôn từ vựng Leitner + thưởng ROOT A đường ôn).
 * Bất biến tiền: CHỈ thưởng khi từ THẬT SỰ đến hạn (isDue) VÀ bấm "đã nhớ" (1 câu
 * Easy) · ôn lại cùng từ ngay sau đó → next_review đẩy tương lai → không due →
 * KHÔNG farm được · box Leitner luôn cập nhật.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
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
