const test = require('node:test');
const assert = require('node:assert/strict');
const { createSource } = require('../src/index');

// Helper: build a fake Slack client returning fixed messages
function makeClient(messages) {
  return {
    conversations: {
      history: async () => ({ ok: true, messages, has_more: false }),
    },
    chat: {
      postMessage: async () => ({ ok: true }),
    },
  };
}

function jsonMsg(dateStr, fetchedAt, extra = {}) {
  const body = JSON.stringify({ fetchedAt, dau: 100, ...extra });
  return {
    ts: String(fetchedAt / 1000),
    text: `[hex-snapshot] ${dateStr}\n\`\`\`${body}\`\`\``,
  };
}

test('fetch returns newest snapshot with fresh stale flag', async () => {
  const now = Date.now();
  const client = makeClient([
    jsonMsg('2026-08-02', now - 1000 * 60 * 60), // 1h ago
    jsonMsg('2026-08-01', now - 1000 * 60 * 60 * 48), // 48h ago
  ]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  const snap = await src.fetch();
  assert.equal(snap.stale, false);
  assert.equal(snap.dau, 100);
});

test('fetch flags snap as stale past threshold', async () => {
  const now = Date.now();
  const client = makeClient([jsonMsg('2026-07-30', now - 1000 * 60 * 60 * 96)]); // 96h ago
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  const snap = await src.fetch();
  assert.equal(snap.stale, true);
});

test('fetch returns a stale sentinel when no snapshots in channel', async () => {
  const client = makeClient([{ ts: '1', text: 'unrelated' }]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  assert.deepEqual(await src.fetch(), { fetchedAt: null, stale: true });
});

test('fetchOrDefer returns deferred:false when fresh on first try', async () => {
  const client = makeClient([jsonMsg('2026-08-02', Date.now() - 60_000)]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
    retry: { maxAttempts: 3, delayMs: 1 },
    nudge: { channel: 'C_NUDGE', userId: 'U1', skillName: 's', voice: '🌸', dataChannel: 'C1' },
  });
  const res = await src.fetchOrDefer();
  assert.equal(res.deferred, false);
  assert.equal(res.attempts, 1);
  assert.equal(res.snap.dau, 100);
});

test('fetchOrDefer posts nudge on give-up when nudge config present', async () => {
  const posts = [];
  const client = {
    conversations: {
      history: async () => ({ ok: true, messages: [jsonMsg('2026-07-30', Date.now() - 96 * 3600 * 1000)], has_more: false }),
    },
    chat: {
      postMessage: async (args) => { posts.push(args); return { ok: true }; },
    },
  };
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
    retry: { maxAttempts: 2, delayMs: 1 },
    nudge: { channel: 'C_NUDGE', userId: 'U1', skillName: 'my-skill', voice: '🌸', dataChannel: 'C1' },
  });
  const res = await src.fetchOrDefer();
  assert.equal(res.deferred, true);
  assert.equal(res.attempts, 2);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].channel, 'C_NUDGE');
  assert.match(posts[0].text, /my-skill/);
});

test('fetchOrDefer skips nudge when nudge config absent, still returns deferred:true', async () => {
  const posts = [];
  const client = {
    conversations: {
      history: async () => ({ ok: true, messages: [jsonMsg('2026-07-30', Date.now() - 96 * 3600 * 1000)], has_more: false }),
    },
    chat: {
      postMessage: async (args) => { posts.push(args); return { ok: true }; },
    },
  };
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
    retry: { maxAttempts: 2, delayMs: 1 },
    // no nudge
  });
  const res = await src.fetchOrDefer();
  assert.equal(res.deferred, true);
  assert.equal(posts.length, 0);
});

test('fetchBaseline bins by metricDay when present (not Slack post date)', async () => {
  // Regression: 2026-09-08 Fleur false alarm. A Sunday snapshot representing
  // Saturday's data was treated as distinct from a Monday snapshot also
  // representing Saturday's data, producing a bogus non-adjacent DoD.
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const client = makeClient([
    // Two different Slack post-days, SAME metricDay — must dedup to one entry.
    jsonMsg('2026-09-06', now - 1000, { metricDay: '2026-09-06' }),
    jsonMsg('2026-09-06', now - oneDay, { metricDay: '2026-09-06' }),
    jsonMsg('2026-09-02', now - 5 * oneDay, { metricDay: '2026-09-02' }),
    jsonMsg('2026-09-01', now - 6 * oneDay, { metricDay: '2026-09-01' }),
  ]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  const baseline = await src.fetchBaseline({ days: 3, excludeMetricDay: '2026-09-06' });
  // Sept 6 excluded (matches excludeMetricDay), leaving only Sept 2 and Sept 1
  assert.equal(baseline.length, 2);
  assert.equal(baseline[0].metricDay, '2026-09-02');
  assert.equal(baseline[1].metricDay, '2026-09-01');
});

test('fetchBaseline returns N most-recent unique-day snapshots excluding today', async () => {
  // Build a mix: 2 snapshots today, 1 yesterday, 1 two days ago
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const todayISO = new Date(now).toISOString().split('T')[0];
  const yestISO = new Date(now - oneDay).toISOString().split('T')[0];
  const dayBeforeISO = new Date(now - 2 * oneDay).toISOString().split('T')[0];
  const client = makeClient([
    jsonMsg(todayISO, now - 1000),
    jsonMsg(todayISO, now - 10000),
    jsonMsg(yestISO, now - oneDay),
    jsonMsg(dayBeforeISO, now - 2 * oneDay),
  ]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  const baseline = await src.fetchBaseline({ days: 3 });
  assert.equal(baseline.length, 2);
  // Neither should be marked stale (baselines are expected to be old)
  assert.equal(baseline[0].stale, false);
  assert.equal(baseline[1].stale, false);
});

test('fetch sentinel is safe to consume via .stale check', async () => {
  const client = makeClient([{ ts: '1', text: 'unrelated' }]);
  const src = createSource({
    type: 'health-snapshot',
    slack: { channel: 'C1', client },
    parser: 'standard-json',
  });
  const snap = await src.fetch();
  // Caller pattern: check .stale before dereferencing other fields
  assert.equal(snap.stale, true);
  assert.equal(snap.fetchedAt, null);
});

test('createSource rejects unsupported type', () => {
  assert.throws(
    () => createSource({ type: 'chat-brief', slack: { channel: 'C', client: {} }, parser: 'standard-json' }),
    /type/
  );
});
