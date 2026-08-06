const DEFAULT_LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const DEFAULT_MAX_PAGES = 3;
const PAGE_SIZE = 200;

async function fetchSnapshotMessages(
  slackClient,
  { channel, lookbackMs = DEFAULT_LOOKBACK_MS, maxPages = DEFAULT_MAX_PAGES } = {}
) {
  if (!channel) {
    throw new Error('fetchSnapshotMessages: `channel` is required');
  }
  const oldestSeconds = Math.floor((Date.now() - lookbackMs) / 1000);
  const all = [];
  let cursor;
  let page = 0;
  try {
    while (page < maxPages) {
      const args = {
        channel,
        limit: PAGE_SIZE,
        oldest: String(oldestSeconds),
      };
      if (cursor) args.cursor = cursor;
      const res = await slackClient.conversations.history(args);
      const messages = res.messages || [];
      all.push(...messages);
      page++;
      if (!res.has_more) break;
      cursor = res.response_metadata && res.response_metadata.next_cursor;
      if (!cursor) break;
    }
    return all;
  } catch (err) {
    console.warn('[hex-slack-source] fetchSnapshotMessages failed:', err.message);
    return [];
  }
}

module.exports = { fetchSnapshotMessages };
