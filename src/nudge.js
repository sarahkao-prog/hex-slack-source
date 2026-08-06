const DEFAULT_TEMPLATE =
  "{voice} today's brief is deferred — Hex snapshot is stale (last update >36h ago). " +
  "<@{userId}> please run `{skillName}` in Claude Code; once the snapshot lands in " +
  "<#{dataChannel}> I'll pick it up at tomorrow's scheduled cycle. For an on-demand " +
  "brief with today's numbers: run the daily command after Hex lands.";

function renderNudge({ userId, skillName, voice, dataChannel, template } = {}) {
  const tmpl = template || DEFAULT_TEMPLATE;
  return tmpl
    .replace(/\{voice\}/g, voice || '')
    .replace(/\{userId\}/g, userId || '')
    .replace(/\{skillName\}/g, skillName || '')
    .replace(/\{dataChannel\}/g, dataChannel || '');
}

async function postNudge(slackClient, config) {
  const text = renderNudge(config);
  try {
    await slackClient.chat.postMessage({ channel: config.channel, text });
    return { ok: true };
  } catch (err) {
    console.warn('[hex-slack-source] postNudge failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { renderNudge, postNudge, DEFAULT_TEMPLATE };
