function isStale(fetchedAtMs, staleAfterMs, nowMs = Date.now()) {
  if (fetchedAtMs == null) return true;
  return nowMs - fetchedAtMs >= staleAfterMs;
}

module.exports = { isStale };
