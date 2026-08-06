const test = require('node:test');
const assert = require('node:assert/strict');
const { renderNudge, postNudge } = require('../src/nudge');

test('default template includes voice, user mention, skill name, and data channel', () => {
  const body = renderNudge({
    userId: 'U123',
    skillName: 'bloom-hex-brief',
    voice: '🌸',
    dataChannel: 'C_DATA',
  });
  assert.match(body, /🌸/);
  assert.match(body, /<@U123>/);
  assert.match(body, /bloom-hex-brief/);
  assert.match(body, /<#C_DATA>/);
  assert.match(body, /deferred/i);
});

test('custom template interpolates all placeholders', () => {
  const body = renderNudge({
    userId: 'U9',
    skillName: 'my-skill',
    voice: '⚡',
    dataChannel: 'C_X',
    template: '{voice} hey <@{userId}>, run {skillName} — output goes to <#{dataChannel}>',
  });
  assert.equal(body, '⚡ hey <@U9>, run my-skill — output goes to <#C_X>');
});

test('postNudge posts to configured channel and returns {ok:true}', async () => {
  const posts = [];
  const client = {
    chat: {
      postMessage: async (args) => {
        posts.push(args);
        return { ok: true, ts: '1.2' };
      },
    },
  };
  const res = await postNudge(client, {
    channel: 'C_NUDGE',
    userId: 'U1',
    skillName: 'foo',
    voice: '🌸',
    dataChannel: 'C_DATA',
  });
  assert.equal(res.ok, true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].channel, 'C_NUDGE');
  assert.match(posts[0].text, /foo/);
});

test('postNudge returns {ok:false, error} on client failure, does not throw', async () => {
  const client = {
    chat: {
      postMessage: async () => { throw new Error('slack down'); },
    },
  };
  // Silence console.warn
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const res = await postNudge(client, {
      channel: 'C',
      userId: 'U',
      skillName: 's',
      voice: '🌸',
      dataChannel: 'C_DATA',
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'slack down');
  } finally {
    console.warn = origWarn;
  }
});
