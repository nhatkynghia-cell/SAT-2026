/**
 * INTEGRATION — /api/vocab GET (lazy-seed Cambridge KET/PET vào SRS Leitner).
 * Bất biến seed:
 *  • User mới (chưa marker) → GET seed KET + sentinel → 20 từ lô đầu due hôm nay.
 *  • GET lần 2 → KHÔNG double-seed (số từ giữ nguyên).
 *  • Marker __seed_version__ KHÔNG lọt dueWords (không crash page).
 *  • POST ôn 1 từ due vẫn +5/+20, box 1→2, marker vẫn còn (không phá seed).
 *  • User SAT cũ (words không marker) → GET seed thêm KET + giữ từ cũ, không crash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
import { GET, POST } from '@/app/api/vocab/route';
import { SEED_MARKER_ID } from '@/lib/vocab-seed';
import { getSeedWords } from '@/lib/vocab-seed';
import { todayStr } from '@/lib/leitner';

function seedUser(id, coins = 100) {
  seed('user_economy', { user_id: id, coins, xp: 0, inventory: [], last_spin_date: null });
}
function vocabRows(id) {
  const rows = getRows('user_vocab_srs');
  return rows.filter((r) => r.user_id === id);
}

test('vocab-seed: user mới → GET seed KET + marker, dueWords = 20 lô đầu (đều KET)', async () => {
  resetDb(); setCurrentUser({ id: 's1' }); seedUser('s1');

  const { status, body } = await readRes(await GET());
  assert.equal(status, 200);

  const rows = vocabRows('s1');
  assert.equal(rows.length, 1, '1 dòng user_vocab_srs');
  const words = rows[0].words;
  const ketCount = getSeedWords('KET').length;
  assert.ok(words.some((w) => w.id === SEED_MARKER_ID), 'phải có sentinel marker');
  assert.equal(words.length, ketCount + 1, `words = ${ketCount} KET + 1 marker`);

  assert.equal(body.words.length, 20, 'lô đầu due hôm nay = 20 từ');
  assert.ok(body.words.every((w) => w.exam === 'KET'), 'dueWords đều KET');
  assert.equal(body.words[0].next_review, todayStr(), 'lô 0 due hôm nay');
});

test('vocab-seed: GET lần 2 → KHÔNG double-seed (số từ giữ nguyên)', async () => {
  resetDb(); setCurrentUser({ id: 's2' }); seedUser('s2');

  await readRes(await GET());
  const after1 = vocabRows('s2')[0].words.length;

  await readRes(await GET());
  const after2 = vocabRows('s2')[0].words.length;

  assert.equal(after2, after1, `double-seed: ${after1} → ${after2}`);
});

test('vocab-seed: marker không lọt dueWords (không crash page render)', async () => {
  resetDb(); setCurrentUser({ id: 's3' }); seedUser('s3');
  const { body } = await readRes(await GET());
  assert.ok(!body.words.some((w) => w.id === SEED_MARKER_ID), 'marker lọt dueWords');
  assert.ok(body.words.every((w) => w.word && typeof w.word === 'string'), 'mọi dueWord phải có word');
});

test('vocab-seed: POST ôn 1 từ due → +5/+20, box 1→2, marker vẫn còn', async () => {
  resetDb(); setCurrentUser({ id: 's4' }); seedUser('s4');
  const { body } = await readRes(await GET());
  const w1 = body.words[0];
  const totalBefore = vocabRows('s4')[0].words.length;

  const r = await readRes(await POST(postJson({ wordId: w1.id, isRemembered: true })));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.granted, { coins: 5, xp: 20 });
  assert.equal(r.body.word.box, 2, 'box 1→2 khi nhớ');

  const words = vocabRows('s4')[0].words;
  assert.ok(words.some((w) => w.id === SEED_MARKER_ID), 'marker vẫn còn sau POST');
  assert.equal(words.length, totalBefore, 'POST không thêm/xoá từ, chỉ cập nhật box');
});

test('vocab-seed: user SAT cũ (words không marker) → GET seed thêm KET + giữ từ cũ', async () => {
  resetDb(); setCurrentUser({ id: 's5' }); seedUser('s5');
  // User SAT cũ: words chỉ {id,box,next_review}, không marker.
  seed('user_vocab_srs', { user_id: 's5', words: [{ id: 'sat-w1', box: 3, next_review: '2020-01-01' }] });

  const { status, body } = await readRes(await GET());
  assert.equal(status, 200);

  const words = vocabRows('s5')[0].words;
  assert.ok(words.some((w) => w.id === 'sat-w1'), 'giữ từ SAT cũ');
  assert.ok(words.some((w) => w.id === SEED_MARKER_ID), 'đã seed thêm marker');
  // dueWords: sat-w1 (due quá khứ) + 20 KET lô đầu = 21 (marker bị loại).
  const satDue = body.words.some((w) => w.id === 'sat-w1');
  assert.ok(satDue, 'từ SAT cũ due vẫn xuất hiện');
});
