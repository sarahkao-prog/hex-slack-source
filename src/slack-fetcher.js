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
  // NOTE: Slack conversations.history returns messages in reverse chronological
  // order (newest first) ONLY when neither `oldest` alone nor certain combos
  // are set. Earlier versions of this fetcher set `oldest` alone, which caused
  // Slack to page from OLDEST forward under some workspace configurations —
  // meaning the caller received the OLDEST N messages of the lookback window
  // rather than the newest. Fresh snapshots posted today were silently
  // truncated out of the result set (2026-08-27 incident, Fleur).
  //
  // Fix: use `latest = now` so we always page from newest → older via cursor.
  // We still apply lookbackMs as a floor for defense-in-depth, but iteration
  // stops naturally once we hit maxPages or the channel runs out.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const oldestSeconds = Math.floor((Date.now() - lookbackMs) / 1000);
  const all = [];
  let cursor;
  let page = 0;
  try {
    while (page < maxPages) {
      const args = {
        channel,
        limit: PAGE_SIZE,
        latest: String(nowSeconds),
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
