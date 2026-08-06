# @sarahkao-prog/hex-slack-source

Shared Hex-snapshot-from-Slack source for Fortis community Slack bots (Fern, Fleur, Sprout).

## Install

```bash
npm install @sarahkao-prog/hex-slack-source
```

Consumers need an `.npmrc` in the repo root pointing the `@sarahkao-prog` scope at GitHub Packages:

```
@sarahkao-prog:registry=https://npm.pkg.github.com
```

Public package — no auth token required for `npm install`.

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

## Publishing

```bash
npm version patch          # or minor/major
git push --follow-tags
GITHUB_TOKEN=$(gh auth token) npm publish
```

If `gh auth token` output lacks `write:packages` scope, create a PAT at https://github.com/settings/tokens with `write:packages` + `read:packages` and use it as `GITHUB_TOKEN`.
