import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canGeneratePracticeForTier } from './route.ts';

// Free chỉ được đi qua các skill thuộc 2 domain mở sẵn.
test('canGeneratePracticeForTier: free chỉ được skill trong FREE_DOMAINS', () => {
  assert.equal(canGeneratePracticeForTier('free', 'algebra.linear_eq'), true);
  assert.equal(canGeneratePracticeForTier('free', 'rw.vocab'), true);
  assert.equal(canGeneratePracticeForTier('free', 'advanced.quadratic'), false);
  assert.equal(canGeneratePracticeForTier('free', 'geo.trig'), false);
});

test('canGeneratePracticeForTier: paid tiers không bị chặn', () => {
  assert.equal(canGeneratePracticeForTier('premium', 'advanced.quadratic'), true);
  assert.equal(canGeneratePracticeForTier('ultimate', 'geo.trig'), true);
  assert.equal(canGeneratePracticeForTier('premium', undefined), true);
});
