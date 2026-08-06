const test = require('node:test');
const assert = require('node:assert/strict');
const { retryUntilFresh } = require('../src/retry');

// Instant no-op sleep — makes tests fast and deterministic
const noSleep = async () => {};

test('returns immediately when first call is fresh', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return { fetchedAt: 1000, stale: false };
  };
  const res = await retryUntilFresh(fetchFn, { maxAttempts: 6, delayMs: 100, sleepFn: noSleep });
  assert.equal(res.snap.fetchedAt, 1000);
  assert.equal(res.attempts, 1);
  assert.equal(res.gaveUp, false);
  assert.equal(calls, 1);
});

test('retries until fresh, then returns', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return calls < 3 ? { fetchedAt: 1, stale: true } : { fetchedAt: 999, stale: false };
  };
  const res = await retryUntilFresh(fetchFn, { maxAttempts: 6, delayMs: 100, sleepFn: noSleep });
  assert.equal(res.snap.fetchedAt, 999);
  assert.equal(res.attempts, 3);
  assert.equal(res.gaveUp, false);
});

test('gives up after maxAttempts if always stale', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return { fetchedAt: 1, stale: true };
  };
  const res = await retryUntilFresh(fetchFn, { maxAttempts: 4, delayMs: 100, sleepFn: noSleep });
  assert.equal(res.attempts, 4);
  assert.equal(res.gaveUp, true);
  assert.equal(res.snap.stale, true);
  assert.equal(calls, 4);
});

test('gives up if fetchFn always returns null', async () => {
  const fetchFn = async () => null;
  const res = await retryUntilFresh(fetchFn, { maxAttempts: 3, delayMs: 100, sleepFn: noSleep });
  assert.equal(res.snap, null);
  assert.equal(res.attempts, 3);
  assert.equal(res.gaveUp, true);
});

test('sleeps between attempts (via sleepFn)', async () => {
  const sleepDelays = [];
  const sleepFn = async (ms) => { sleepDelays.push(ms); };
  const fetchFn = async () => ({ fetchedAt: 1, stale: true });
  await retryUntilFresh(fetchFn, { maxAttempts: 3, delayMs: 5000, sleepFn });
  // 3 attempts = 2 sleeps between them (not after the last)
  assert.deepEqual(sleepDelays, [5000, 5000]);
});
