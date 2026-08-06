const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchSnapshotMessages } = require('../src/slack-fetcher');

// Minimal fake Slack client
function fakeClient(pages) {
  let call = 0;
  return {
    conversations: {
      history: async (args) => {
        const page = pages[call++];
        return {
          ok: true,
          messages: page.messages,
          has_more: page.has_more || false,
          response_metadata: page.next_cursor ? { next_cursor: page.next_cursor } : undefined,
        };
      },
    },
  };
}

test('returns messages from single page', async () => {
  const client = fakeClient([
    { messages: [{ ts: '1', text: 'a' }, { ts: '2', text: 'b' }] },
  ]);
  const out = await fetchSnapshotMessages(client, { channel: 'C1' });
  assert.equal(out.length, 2);
});

test('paginates up to maxPages', async () => {
  const client = fakeClient([
    { messages: [{ ts: '1', text: 'a' }], has_more: true, next_cursor: 'p2' },
    { messages: [{ ts: '2', text: 'b' }], has_more: true, next_cursor: 'p3' },
    { messages: [{ ts: '3', text: 'c' }], has_more: true, next_cursor: 'p4' }, // maxPages=3 stops here
  ]);
  const out = await fetchSnapshotMessages(client, { channel: 'C1', maxPages: 3 });
  assert.equal(out.length, 3);
});

test('stops on has_more=false even if maxPages allows more', async () => {
  const client = fakeClient([
    { messages: [{ ts: '1', text: 'a' }], has_more: false },
  ]);
  const out = await fetchSnapshotMessages(client, { channel: 'C1', maxPages: 5 });
  assert.equal(out.length, 1);
});

test('returns [] and logs on API error', async () => {
  const errClient = {
    conversations: {
      history: async () => { throw new Error('boom'); },
    },
  };
  // Silence console.warn during test
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const out = await fetchSnapshotMessages(errClient, { channel: 'C1' });
    assert.deepEqual(out, []);
  } finally {
    console.warn = origWarn;
  }
});

test('throws if channel missing', async () => {
  await assert.rejects(
    () => fetchSnapshotMessages(fakeClient([{ messages: [] }]), {}),
    /channel/i
  );
});
