import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cefrLabel,
  cefrShortLabel,
  cefrColor,
  cefrExam,
  cefrGap,
  bandOfSkill,
  SKILL_BAND_MAP,
  // re-export từ score-math — kiểm tra trụ 1 chỗ
  masteryToCEFR,
  cefrToScale,
  TARGET_LEVELS,
  SCALE_MIN,
  SCALE_MAX,
} from './cefr.ts';
import type { CEFRLevel } from './cefr.ts';

test('re-export: cefr.ts truy xuất được symbol lõi từ score-math', () => {
  assert.equal(typeof masteryToCEFR, 'function');
  assert.equal(typeof cefrToScale, 'function');
  assert.deepEqual(TARGET_LEVELS, ['A1', 'A2', 'B1']);
  assert.equal(SCALE_MIN, 82);
  assert.equal(SCALE_MAX, 170);
});

test('cefrLabel: nhãn song ngữ cho 4 bậc (đại diện + biên)', () => {
  assert.equal(cefrLabel('A2'), 'A2 · KET (Cơ bản)');
  assert.equal(cefrLabel('B1'), 'B1 · PET (Trung cấp)');
  assert.equal(cefrLabel('A1'), 'A1 · Pre-KET');
  assert.equal(cefrLabel('Pre-A1'), 'Pre-A1 · Chưa xếp lớp');
});

test('cefrShortLabel: nhãn ngắn = tên bậc (chip nhỏ)', () => {
  assert.equal(cefrShortLabel('A2'), 'A2');
  assert.equal(cefrShortLabel('B1'), 'B1');
  assert.equal(cefrShortLabel('Pre-A1'), 'Pre-A1');
});

test('cefrColor: trả đủ 3 field className tailwind, khác nhau theo bậc', () => {
  const a2 = cefrColor('A2');
  assert.ok(a2.bg && a2.text && a2.ring, 'phải có đủ bg/text/ring');
  assert.match(a2.bg, /^bg-blue-100$/);
  assert.match(a2.text, /^text-blue-700$/);
  // B1 xanh lá, khác màu với A2 xanh dương
  const b1 = cefrColor('B1');
  assert.notEqual(b1.bg, a2.bg);
  // Pre-A1 xám (biên dưới)
  assert.match(cefrColor('Pre-A1').bg, /^bg-gray-100$/);
});

test('cefrExam: A2→KET, B1→PET, Pre-A1/A1→null (chưa đủ thi)', () => {
  assert.equal(cefrExam('A2'), 'KET');
  assert.equal(cefrExam('B1'), 'PET');
  assert.equal(cefrExam('Pre-A1'), null);
  assert.equal(cefrExam('A1'), null);
});

test('cefrGap: còn bậc dương khi current < target', () => {
  assert.deepEqual(cefrGap('A1', 'B1'), { steps: 2, label: 'Còn 2 bậc tới B1' });
  assert.deepEqual(cefrGap('A2', 'B1'), { steps: 1, label: 'Còn 1 bậc tới B1' });
  assert.deepEqual(cefrGap('Pre-A1', 'A2'), { steps: 2, label: 'Còn 2 bậc tới A2' });
});

test('cefrGap: steps=0 + "Đã đạt mục tiêu" khi current>=target (không xuống)', () => {
  assert.deepEqual(cefrGap('B1', 'B1'), { steps: 0, label: 'Đã đạt mục tiêu' });
  assert.deepEqual(cefrGap('B1', 'A2'), { steps: 0, label: 'Đã đạt mục tiêu' });
  assert.deepEqual(cefrGap('A2', 'A1'), { steps: 0, label: 'Đã đạt mục tiêu' });
});

test('cefrGap: gap luôn ≥0 (chỉ đi lên, không trả steps âm)', () => {
  const levels: CEFRLevel[] = ['Pre-A1', 'A1', 'A2', 'B1'];
  for (const cur of levels) {
    for (const tgt of levels) {
      const g = cefrGap(cur, tgt);
      assert.ok(g.steps >= 0, `steps không âm cho ${cur}→${tgt}`);
    }
  }
});

test('bandOfSkill: foundation gắn band theo suffix (.a2/.b1)', () => {
  assert.equal(bandOfSkill('grammar.a2'), 'A2');
  assert.equal(bandOfSkill('grammar.b1'), 'B1');
  assert.equal(bandOfSkill('vocabulary.a2'), 'A2');
  assert.equal(bandOfSkill('vocabulary.b1'), 'B1');
});

test('bandOfSkill: skill bám task-type (reading/listening/...) → A2/B1', () => {
  assert.equal(bandOfSkill('reading.notice_mcq'), 'A2/B1');
  assert.equal(bandOfSkill('listening.matching'), 'A2/B1');
  assert.equal(bandOfSkill('writing.email_100'), 'A2/B1');
  assert.equal(bandOfSkill('speaking.interview'), 'A2/B1');
});

test('bandOfSkill: skill lạ có suffix .a2/.b1 → fallback đúng; lạ không suffix → A2/B1', () => {
  assert.equal(bandOfSkill('grammar.a1'), 'A2/B1'); // suffix .a1 không phải bậc thi → mặc định
  assert.equal(bandOfSkill('future-skill.a2'), 'A2'); // fallback suffix
  assert.equal(bandOfSkill('future-skill.b1'), 'B1');
  assert.equal(bandOfSkill('totally-unknown'), 'A2/B1');
});

test('SKILL_BAND_MAP: đồng bộ id với taxonomy (mỗi entry tra đúng band)', () => {
  assert.equal(SKILL_BAND_MAP['grammar.a2'], 'A2');
  assert.equal(SKILL_BAND_MAP['vocabulary.b1'], 'B1');
  // reading là A2/B1 (1 skill phục vụ cả 2 bậc)
  assert.equal(SKILL_BAND_MAP['reading.gapped_text'], 'A2/B1');
});
