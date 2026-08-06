const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retryUntilFresh(fetchFn, { maxAttempts, delayMs, sleepFn = realSleep } = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('retryUntilFresh: maxAttempts must be a positive integer');
  }
  let snap = null;
  let attempts = 0;
  for (let i = 0; i < maxAttempts; i++) {
    snap = await fetchFn();
    attempts = i + 1;
    if (snap && !snap.stale) {
      return { snap, attempts, gaveUp: false };
    }
    if (i < maxAttempts - 1) {
      await sleepFn(delayMs);
    }
  }
  return { snap, attempts, gaveUp: true };
}

module.exports = { retryUntilFresh };
