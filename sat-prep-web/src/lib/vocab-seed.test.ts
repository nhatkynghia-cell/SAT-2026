import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { todayStr } from './leitner.ts';
import {
  getVocabSeed,
  levelToExam,
  getSeedWords,
  toSrsWords,
  makeSeedMarker,
  SEED_VERSION,
  SEED_MARKER_ID,
} from './vocab-seed.ts';

/**
 * vocab-seed.test.ts (UNIT) — kiểm bộ từ vựng seed Cambridge KET/PET + logic
 * SRS thuần (stagger theo lô, marker, levelToExam). JSON seed tĩnh đọc qua fs
 * (giống diagnostic.test.ts — vì @/data alias không resolve an toàn trong node
 * --test thuần); logic test qua vocab-seed.ts theo đường tương đối.
 */
interface RawSeed {
  id: string;
  word: string;
  pos?: string;
  ipa?: string;
  meaning_vi: string;
  meaning_en?: string;
  example: string;
  cefr: 'A2' | 'B1';
  exam: 'KET' | 'PET';
  topic: string;
  audio_url: string;
}

const RAW: RawSeed[] = JSON.parse(
  readFileSync(new URL('../data/vocab_seed.json', import.meta.url), 'utf-8')
);

test('bộ seed không rỗng + đủ lớn cho SRS', () => {
  assert.ok(RAW.length >= 200, `chỉ có ${RAW.length} từ, cần >= 200`);
  assert.ok(getVocabSeed().length === RAW.length, 'getVocabSeed khớp JSON');
});

test('có cả từ KET (A2) và PET (B1)', () => {
  const ket = RAW.filter((w) => w.exam === 'KET');
  const pet = RAW.filter((w) => w.exam === 'PET');
  assert.ok(ket.length >= 100, `KET chỉ có ${ket.length}, cần >= 100`);
  assert.ok(pet.length >= 80, `PET chỉ có ${pet.length}, cần >= 80`);
});

test('mọi từ có id duy nhất', () => {
  const ids = RAW.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'có id trùng trong vocab_seed.json');
});

test('mọi từ có cefr hợp lệ + exam khớp cefr (A2→KET, B1→PET)', () => {
  for (const w of RAW) {
    assert.ok(w.cefr === 'A2' || w.cefr === 'B1', `cefr lạ: ${w.cefr} (${w.id})`);
    assert.equal(levelToExam(w.cefr), w.exam, `${w.id}: cefr ${w.cefr} phải → exam ${levelToExam(w.cefr)}, thực ${w.exam}`);
  }
});

test('id prefix đúng (ket-/pet- + 3 số)', () => {
  for (const w of RAW) {
    const prefix = w.exam.toLowerCase() + '-';
    assert.ok(w.id.startsWith(prefix), `${w.id} phải bắt đầu bằng ${prefix}`);
    assert.ok(/^.{4}[0-9]{3}$/.test(w.id), `${w.id} phải dạng ${prefix}NNN (3 số)`);
  }
});

test('mọi từ có word/meaning_vi/example không rỗng', () => {
  for (const w of RAW) {
    assert.ok(w.word && w.word.trim(), `${w.id}: thiếu word`);
    assert.ok(w.meaning_vi && w.meaning_vi.trim(), `${w.id}: thiếu meaning_vi`);
    assert.ok(w.example && w.example.trim(), `${w.id}: thiếu example`);
  }
});

test('audio_url luôn rỗng (Phase 1 chưa có TTS)', () => {
  for (const w of RAW) {
    assert.equal(w.audio_url, '', `${w.id}: audio_url phải rỗng ở Phase 1`);
  }
});

test('getSeedWords("KET") chỉ trả từ KET, getSeedWords("PET") chỉ trả PET', () => {
  const ket = getSeedWords('KET');
  const pet = getSeedWords('PET');
  assert.ok(ket.every((w) => w.exam === 'KET'), 'getSeedWords(KET) lọt từ PET');
  assert.ok(pet.every((w) => w.exam === 'PET'), 'getSeedWords(PET) lọt từ KET');
  assert.ok(ket.length >= 100 && pet.length >= 80, 'số lượng mỗi exam hợp lý');
});

test('levelToExam: A2→KET, B1→PET', () => {
  assert.equal(levelToExam('A2'), 'KET');
  assert.equal(levelToExam('B1'), 'PET');
});

test('toSrsWords: mọi từ box=1 + giữ field nội dung', () => {
  const srs = toSrsWords(getSeedWords('KET'));
  assert.ok(srs.length === getSeedWords('KET').length, 'số lượng khớp');
  for (const w of srs) {
    assert.equal(w.box, 1, `${w.id}: box phải = 1 lúc seed`);
    assert.ok(w.next_review, `${w.id}: phải có next_review`);
    assert.ok(w.word && w.meaning_vi && w.example, `${w.id}: phải giữ field nội dung`);
  }
});

test('toSrsWords STAGGER: lô 0 due hôm nay, lô k due today+k ngày (DAILY_NEW=20)', () => {
  const seed = getSeedWords('KET');
  if (seed.length < 41) return; // cần đủ 2+ lô để test stagger
  const srs = toSrsWords(seed, 20);
  const today = todayStr();
  assert.equal(srs[0].next_review, today, 'lô 0 (20 từ đầu) phải due HÔM NAY');
  assert.equal(srs[20].next_review, addDaysStr(today, 1), 'lô 1 phải due today+1');
  assert.equal(srs[40].next_review, addDaysStr(today, 2), 'lô 2 phải due today+2');
});

test('toSrsWords STAGGER: không 2 lô khác nhau cùng due 1 ngày', () => {
  const seed = getSeedWords('KET');
  const srs = toSrsWords(seed, 20);
  const reviews = srs.map((w) => w.next_review);
  const distinct = new Set(reviews);
  const expectedBatches = Math.ceil(seed.length / 20);
  assert.equal(distinct.size, expectedBatches, `số ngày due (${distinct.size}) phải = số lô (${expectedBatches})`);
});

test('makeSeedMarker: sentinel đúng shape + SEED_MARKER_ID ổn định', () => {
  const m = makeSeedMarker();
  assert.equal(m.id, SEED_MARKER_ID);
  assert.equal(m.value, SEED_VERSION);
  assert.ok(m.seededAt, 'marker phải có seededAt ISO');
});

// Helper cộng ngày (mirror addDays trong vocab-seed.ts — không export ở đó nên tự test).
function addDaysStr(baseYyyyMmDd: string, n: number): string {
  const d = new Date(baseYyyyMmDd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}
