import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS,
  getPlan,
  computeExpiry,
  isActive,
  resolveTier,
  type SubscriptionRecord,
} from './subscription.ts';

function sub(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    tier: 'premium',
    period: 'monthly',
    startedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  };
}

test('PLANS: có đủ 8 tổ hợp tier×period, giá > 0, duration đúng', () => {
  assert.equal(PLANS.length, 8);
  const EXPECTED_DAYS: Record<string, number> = {
    monthly: 30,
    quarterly: 90,
    semiannual: 180,
    yearly: 365,
  };
  for (const p of PLANS) {
    assert.ok(p.priceVnd > 0, `${p.tier}/${p.period} giá phải > 0`);
    assert.equal(p.durationDays, EXPECTED_DAYS[p.period], `${p.tier}/${p.period} durationDays sai`);
  }
});

test('getPlan: tra đúng gói; tổ hợp lạ → undefined', () => {
  assert.equal(getPlan('premium', 'monthly')?.durationDays, 30);
  assert.equal(getPlan('ultimate', 'yearly')?.durationDays, 365);
  // @ts-expect-error tier không hợp lệ cố ý
  assert.equal(getPlan('free', 'monthly'), undefined);
});

test('computeExpiry: cộng đúng số ngày (UTC)', () => {
  assert.equal(computeExpiry('2026-01-01T00:00:00.000Z', 30), '2026-01-31T00:00:00.000Z');
  assert.equal(computeExpiry('2026-01-01T00:00:00.000Z', 365), '2027-01-01T00:00:00.000Z');
});

test('isActive: còn hạn khi expiresAt > now', () => {
  const s = sub({ expiresAt: '2026-02-01T00:00:00.000Z' });
  assert.equal(isActive(s, '2026-01-15T00:00:00.000Z'), true);
  assert.equal(isActive(s, '2026-03-01T00:00:00.000Z'), false);
});

test('isActive: null / thiếu expiresAt → false (fail-safe)', () => {
  assert.equal(isActive(null, '2026-01-15T00:00:00.000Z'), false);
  assert.equal(isActive(sub({ expiresAt: '' }), '2026-01-15T00:00:00.000Z'), false);
});

test('isActive: đúng thời điểm hết hạn (expiresAt == now) → false (không còn hiệu lực)', () => {
  const s = sub({ expiresAt: '2026-01-31T00:00:00.000Z' });
  assert.equal(isActive(s, '2026-01-31T00:00:00.000Z'), false);
});

test('resolveTier: còn hạn → tier gói; hết hạn/null → free', () => {
  const s = sub({ tier: 'ultimate', expiresAt: '2026-02-01T00:00:00.000Z' });
  assert.equal(resolveTier(s, '2026-01-15T00:00:00.000Z'), 'ultimate');
  assert.equal(resolveTier(s, '2026-03-01T00:00:00.000Z'), 'free');
  assert.equal(resolveTier(null, '2026-01-15T00:00:00.000Z'), 'free');
});
