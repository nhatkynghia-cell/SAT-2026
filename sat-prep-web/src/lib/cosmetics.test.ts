import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestFrameFor,
  bestTitleFor,
  tierPerkCosmeticIds,
  EARNED_COSMETIC_IDS,
  seasonKey,
} from './cosmetics.ts';

// nowISO tuỳ ý — champion nay VĨNH VIỄN (không gắn season) nên mùa không đổi kết quả.
const NOW = '2026-07-10T00:00:00.000Z';

// ── tierPerkCosmeticIds: quyền lợi gói tự-sở-hữu theo tier ────────────────────
test('tierPerkCosmeticIds: free → [] (không có quyền lợi cosmetic nào)', () => {
  assert.deepEqual(tierPerkCosmeticIds('free'), []);
});

test('tierPerkCosmeticIds: premium → chỉ danh hiệu Premium (tier-perk requiredTier<=premium)', () => {
  assert.deepEqual(tierPerkCosmeticIds('premium'), ['ctitle_premium']);
});

test('tierPerkCosmeticIds: ultimate → cả 3 tier-perk (frame+title ultimate + title premium)', () => {
  const ids = tierPerkCosmeticIds('ultimate');
  assert.deepEqual(
    [...ids].sort(),
    ['cframe_ultimate', 'ctitle_premium', 'ctitle_ultimate'].sort()
  );
});

test('tierPerkCosmeticIds: KHÔNG bao giờ chứa cosmetic earned (champion) hay skin/theme mua', () => {
  const ids = tierPerkCosmeticIds('ultimate');
  assert.ok(!ids.includes('cframe_champion'), 'champion frame không phải tier-perk');
  assert.ok(!ids.includes('ctitle_champion'), 'champion title không phải tier-perk');
  assert.ok(!ids.includes('cskin_dragon'), 'skin mua không phải tier-perk');
});

// ── EARNED_COSMETIC_IDS: đúng 2 món champion, dùng cho cron cấp ────────────────
test('EARNED_COSMETIC_IDS: đúng khung + danh hiệu Nhà Vô Địch Mùa', () => {
  assert.deepEqual([...EARNED_COSMETIC_IDS].sort(), ['cframe_champion', 'ctitle_champion'].sort());
});

// ── bestFrameFor: gate tier + ownership; earned đè tier-perk ───────────────────
test('bestFrameFor: free → null dù truyền cả catalog (gate tier chặn)', () => {
  const all = [...tierPerkCosmeticIds('ultimate'), ...EARNED_COSMETIC_IDS];
  assert.equal(bestFrameFor('free', all, NOW), null);
});

test('bestFrameFor: ultimate CHƯA vô địch → chỉ ra khung tier-perk (KHÔNG champion)', () => {
  // owned = chỉ tier-perk (chưa persist champion) → hack cũ sẽ trả champion, nay KHÔNG.
  const owned = tierPerkCosmeticIds('ultimate');
  const frame = bestFrameFor('ultimate', owned, NOW);
  assert.ok(frame, 'ultimate có khung tier-perk');
  assert.equal(frame?.id, 'cframe_ultimate');
});

test('bestFrameFor: ultimate ĐÃ vô địch (owned champion) → khung champion thắng (prestige earned)', () => {
  const owned = [...tierPerkCosmeticIds('ultimate'), 'cframe_champion'];
  const frame = bestFrameFor('ultimate', owned, NOW);
  assert.equal(frame?.id, 'cframe_champion');
});

test('bestFrameFor: ultimate KHÔNG sở hữu gì → null (owns nothing)', () => {
  assert.equal(bestFrameFor('ultimate', [], NOW), null);
});

// ── bestTitleFor: tương tự ─────────────────────────────────────────────────────
test('bestTitleFor: premium chỉ owned danh hiệu Premium → ra Chiến Binh Premium', () => {
  const title = bestTitleFor('premium', tierPerkCosmeticIds('premium'), NOW);
  assert.equal(title?.id, 'ctitle_premium');
});

test('bestTitleFor: ultimate ĐÃ vô địch → danh hiệu champion thắng danh hiệu ultimate', () => {
  const owned = [...tierPerkCosmeticIds('ultimate'), 'ctitle_champion'];
  const title = bestTitleFor('ultimate', owned, NOW);
  assert.equal(title?.id, 'ctitle_champion');
});

test('bestTitleFor: premium sở hữu champion id nhưng KHÔNG đủ tier → không lấy được champion', () => {
  // champion requiredTier='ultimate'. Premium dù có id trong owned vẫn bị gate tier.
  const title = bestTitleFor('premium', ['ctitle_champion', 'ctitle_premium'], NOW);
  assert.equal(title?.id, 'ctitle_premium', 'premium chỉ dùng được danh hiệu premium');
});

// ── seasonKey vẫn thuần + tất định (không dùng cho champion nữa nhưng giữ API) ──
test('seasonKey: tất định theo nowISO, đầu vào xấu → S0', () => {
  assert.equal(seasonKey(NOW), seasonKey(NOW));
  assert.equal(seasonKey('rác'), 'S0');
});
