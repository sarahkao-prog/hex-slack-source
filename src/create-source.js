const { isStale } = require('./freshness');
const { resolveParser } = require('./parsers');
const { fetchSnapshotMessages } = require('./slack-fetcher');
const { postNudge } = require('./nudge');
const { retryUntilFresh } = require('./retry');

const DEFAULT_STALE_MS = 36 * 60 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_DELAY_MS = 5 * 60 * 1000;

function createSource(config) {
  const {
    type,
    slack,
    parser,
    freshness = {},
    retry = {},
    nudge,
  } = config || {};

  if (type !== 'health-snapshot') {
    throw new Error(`createSource: unsupported type '${type}' (v0.1.0 supports 'health-snapshot' only)`);
  }
  if (!slack || !slack.channel || !slack.client) {
    throw new Error('createSource: `slack.channel` and `slack.client` are required');
  }

  const parse = resolveParser(parser);
  const staleAfterMs = freshness.staleAfterMs ?? DEFAULT_STALE_MS;
  const maxAttempts = retry.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = retry.delayMs ?? DEFAULT_DELAY_MS;

  async function loadParsedSnapshots() {
    const messages = await fetchSnapshotMessages(slack.client, { channel: slack.channel });
    const snaps = [];
    for (const m of messages) {
      const s = parse(m);
      if (s && typeof s.fetchedAt === 'number') snaps.push(s);
    }
    return snaps;
  }

  async function fetch() {
    const snaps = await loadParsedSnapshots();
    if (snaps.length === 0) return { fetchedAt: null, stale: true };
    snaps.sort((a, b) => b.fetchedAt - a.fetchedAt);
    const newest = snaps[0];
    return { ...newest, stale: isStale(newest.fetchedAt, staleAfterMs) };
  }

  async function fetchOrDefer() {
    const { snap, attempts, gaveUp } = await retryUntilFresh(fetch, { maxAttempts, delayMs });
    if (gaveUp && nudge) {
      await postNudge(slack.client, { ...nudge, dataChannel: nudge.dataChannel || slack.channel });
    }
    return { snap, attempts, deferred: gaveUp };
  }

  async function fetchBaseline({ days = 3 } = {}) {
    const snaps = await loadParsedSnapshots();
    if (snaps.length === 0) return [];
    snaps.sort((a, b) => b.fetchedAt - a.fetchedAt);
    const todayISO = new Date().toISOString().split('T')[0];
    const uniqueByDate = new Map();
    for (const s of snaps) {
      const iso = new Date(s.fetchedAt).toISOString().split('T')[0];
      if (iso === todayISO) continue;
      if (!uniqueByDate.has(iso)) uniqueByDate.set(iso, s);
    }
    return Array.from(uniqueByDate.values())
      .sort((a, b) => b.fetchedAt - a.fetchedAt)
      .slice(0, days)
      .map((s) => ({ ...s, stale: false }));
  }

  return { fetch, fetchOrDefer, fetchBaseline };
}

module.exports = { createSource };
