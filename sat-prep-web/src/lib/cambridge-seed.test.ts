import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSeedQuestions,
  seedBySkill,
  validateAllSeed,
  seedStats,
} from './cambridge-seed.ts';
import { isValidSkill } from './skill-taxonomy.ts';

/**
 * cambridge-seed.test.ts (UNIT) — kiểm loader ngân hàng seed Cambridge KET/PET.
 *
 * Test design pass trong 2 scenario:
 *   • File seed chưa tồn tại / rỗng → SEED=[] → mọi assert vacuous-true
 *     (validateAllSeed ok=true errors=[] do rỗng, getSeedQuestions trả []).
 *   • File seed Phase 2 đã ghi → SEED có dữ liệu → kiểm thực.
 *
 * Test chính chạy SAU khi Phase 2 ghi file cambridge_bank_seed.json (xem ghi
 * chú task): import '@/data/cambridge_bank_seed.json' cần file tồn tại trên
 * đĩa để loader.mjs load (loader KHÔNG fallback {} khi file hoàn toàn thiếu).
 */

test('getSeedQuestions("reading") → mọi câu có moduleType="reading"', () => {
  const rows = getSeedQuestions('reading');
  for (const q of rows) {
    assert.equal(q.moduleType, 'reading', `${q.id}: lọt câu không phải reading`);
  }
});

test('getSeedQuestions("reading","Easy") → thêm filter difficulty=Easy', () => {
  const rows = getSeedQuestions('reading', 'Easy');
  for (const q of rows) {
    assert.equal(q.moduleType, 'reading', `${q.id}: lọt câu không phải reading`);
    assert.equal(q.difficulty, 'Easy', `${q.id}: lọt câu không phải Easy`);
  }
});

test('validateAllSeed() → ok=true, errors=[] (file seed Phase 2 sinh phải pass)', () => {
  const r = validateAllSeed();
  assert.equal(r.ok, true, `có câu seed fail: ${JSON.stringify(r.errors)}`);
  assert.deepEqual(r.errors, []);
});

test('seedBySkill: mọi key là skillId hợp lệ (isValidSkill)', () => {
  const counts = seedBySkill();
  for (const skillId of Object.keys(counts)) {
    assert.ok(
      isValidSkill(skillId),
      `skillId lạ trong seed: ${skillId} (không nằm trong skill-taxonomy)`
    );
  }
});

test('seedStats: total = tổng byModule', () => {
  const s = seedStats();
  const moduleTotal = Object.values(s.byModule).reduce((a, b) => a + b, 0);
  assert.equal(s.total, moduleTotal, 'total ≠ tổng byModule');
});

test('seedStats: invalidCount = errors.length của validateAllSeed', () => {
  const s = seedStats();
  const v = validateAllSeed();
  assert.equal(
    s.invalidCount,
    v.errors.length,
    'invalidCount phải khớp số câu fail validateAllSeed'
  );
});
