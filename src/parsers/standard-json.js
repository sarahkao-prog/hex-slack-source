const MARKER_RE = /\[hex-snapshot\]/;
// Match ```json...``` OR bare ```...``` — capture inner JSON body.
// Non-greedy match on body; require { ... } content to skip prose fences.
const FENCE_RE = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;

function parseStandardJson(message) {
  if (!message || typeof message.text !== 'string') return null;
  const text = message.text;
  if (!MARKER_RE.test(text)) return null;
  const match = text.match(FENCE_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

module.exports = { parseStandardJson };
