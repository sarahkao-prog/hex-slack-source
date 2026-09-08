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

  // Bins by `metricDay` (the day the data represents) — falls back to the
  // Slack-post ISO date only when the snapshot lacks `metricDay`. Fleur's
  // 2026-09-08 false-alarm bug was that a Sunday snapshot representing
  // Saturday's data was treated as a distinct day from Monday's post that
  // *also* represented Saturday's data, producing a non-adjacent DoD.
  //
  // Callers who know the current snap's metricDay should pass it via
  // `excludeMetricDay` so baseline[0] is the metric-day before, not the
  // same day.
  async function fetchBaseline({ days = 3, excludeMetricDay = null } = {}) {
    const snaps = await loadParsedSnapshots();
    if (snaps.length === 0) return [];
    snaps.sort((a, b) => b.fetchedAt - a.fetchedAt);

    const dayKey = (s) => s.metricDay || new Date(s.fetchedAt).toISOString().split('T')[0];
    const excludeKey = excludeMetricDay || new Date().toISOString().split('T')[0];

    const uniqueByDay = new Map();
    for (const s of snaps) {
      const key = dayKey(s);
      if (key === excludeKey) continue;
      if (!uniqueByDay.has(key)) uniqueByDay.set(key, s);
    }

    return Array.from(uniqueByDay.values())
      .sort((a, b) => {
        const ka = dayKey(a);
        const kb = dayKey(b);
        if (ka !== kb) return kb.localeCompare(ka);
        return b.fetchedAt - a.fetchedAt;
      })
      .slice(0, days)
      .map((s) => ({ ...s, stale: false }));
  }

  return { fetch, fetchOrDefer, fetchBaseline };
}

module.exports = { createSource };
