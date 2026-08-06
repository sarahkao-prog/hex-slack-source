# @sarahkao-prog/hex-slack-source

Shared Hex-snapshot-from-Slack source for Fortis community Slack bots (Fern, Fleur, Sprout).

## Install

Consumed as a git URL dependency — no npm registry, no auth token required.

```bash
npm install github:sarahkao-prog/hex-slack-source#v0.1.0
```

Consumer `package.json` ends up with:

```json
"@sarahkao-prog/hex-slack-source": "github:sarahkao-prog/hex-slack-source#v0.1.0"
```

Upgrades: re-tag the library (`git tag vX.Y.Z && git push --tags`), then in each consumer bump the ref in `package.json` and run `npm install`. Railway auto-installs from the git URL on redeploy.

## Usage

```js
const { createSource } = require('@sarahkao-prog/hex-slack-source');

const bloomHealth = createSource({
  type: 'health-snapshot',
  slack: {
    channel: process.env.FLEUR_DATA_CHANNEL,
    client: app.client,           // Slack Bolt WebClient
  },
  parser: 'standard-json',
  freshness: { staleAfterMs: 36 * 60 * 60 * 1000 },
  retry: { maxAttempts: 6, delayMs: 5 * 60 * 1000 },
  nudge: {
    channel: process.env.FLEUR_DAILY_CHANNEL,
    userId: process.env.SARAH_USER_ID || 'U078FKN6ABD',
    skillName: 'bloom-hex-brief',
    voice: '🌸',
  },
});

// On-demand — no retry, no nudge:
const snap = await bloomHealth.fetch();
// `fetch()` never returns null: on empty channel or Slack fetch failure it returns a stale sentinel `{ fetchedAt: null, stale: true }`. Callers must check `.stale` before dereferencing other fields.

// Scheduled — retries up to 30min, posts nudge on give-up:
const { snap, deferred, attempts } = await bloomHealth.fetchOrDefer();

// For day-over-day/trend:
const baseline = await bloomHealth.fetchBaseline({ days: 3 });
```

## Snapshot format

Library reads Slack messages whose text contains `[hex-snapshot]` and a fenced ` ```json … ``` ` (or bare ` ``` … ``` `) block. The parsed body must include at least `fetchedAt` (ms epoch). See `test/fixtures/standard-json-messages.js` for real examples.

## Testing

```bash
node --test test/
```

## Releasing a new version

```bash
npm version patch          # or minor/major — updates package.json + creates a git tag
git push --follow-tags     # pushes the tag to GitHub
```

Then in each consumer (`fleur-slackbot`, `twilight-slackbot`, `sprout-bot`) bump the `#vX.Y.Z` ref in `package.json` and run `npm install`.
