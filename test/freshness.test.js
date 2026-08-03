const test = require('node:test');
const assert = require('node:assert/strict');
const { isStale } = require('../src/freshness');

const HOUR = 60 * 60 * 1000;

test('returns true when fetchedAtMs is null', () => {
  assert.equal(isStale(null, 36 * HOUR, 1_000_000), true);
});

test('returns true when fetchedAtMs is undefined', () => {
  assert.equal(isStale(undefined, 36 * HOUR, 1_000_000), true);
});

test('returns false when snapshot is fresh (1h old, threshold 36h)', () => {
  const now = 1_000_000_000;
  assert.equal(isStale(now - 1 * HOUR, 36 * HOUR, now), false);
});

test('returns true when snapshot is exactly at threshold', () => {
  const now = 1_000_000_000;
  assert.equal(isStale(now - 36 * HOUR, 36 * HOUR, now), true);
});

test('returns true when snapshot is past threshold (4 days old, threshold 36h)', () => {
  const now = 1_000_000_000;
  assert.equal(isStale(now - 96 * HOUR, 36 * HOUR, now), true);
});

test('uses Date.now() when nowMs not provided', () => {
  // Snapshot from ~1 minute ago is fresh under any reasonable threshold
  assert.equal(isStale(Date.now() - 60 * 1000, 36 * HOUR), false);
});
