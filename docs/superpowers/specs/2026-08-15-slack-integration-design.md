# Slack integration — ingest and send

**Status:** approved for the read path; the send path (§5) and testing
plan (§6) are written but not yet reviewed.
**Date:** 2026-08-15

Slack is the richest commitment source Headroom can reach. The promises
that never touch a PR description or a calendar invite — "yeah, I'll get
you that by Thursday" — live in Slack DMs. This spec covers landing those
messages in the life graph as `Artifact` rows, and a Tier 2 action for
sending a message back.

## 1. Scope

**In:** OAuth install, encrypted token storage, incremental message
ingest into `Artifact`, and a Tier 2 `sendSlackMessage` action.

**Out, deliberately:**

- **Commitment extraction.** Slack prose is far noisier than PR titles,
  and the ≥90% precision bar on `owed_by_me` (design doc §6) needs an
  eval set built from real messages. This phase produces those messages;
  extraction is a separate spec written against them, not blind.
- **Thread replies.** `conversations.history` returns thread parents but
  not replies; fetching them costs one `conversations.replies` call per
  thread against a ~50/min rate limit. Without extraction there is
  nothing to spend that budget on. Revisit when extraction lands.
- **Events API / webhooks.** Every other integration here is a pull with
  a cursor. Push would add a public unauthenticated endpoint and a second
  sync path for no benefit at this phase.

## 2. Workspace and token model

Headroom installs into a **personal workspace the user owns**, so scope
grants need no admin approval. The code is written for the general case,
so gaining access to a managed workspace later changes the install path
only, not the implementation.

**User token (`xoxp-`), not bot token.** A bot token sees only channels
it is invited to and can never read DMs, which is where most commitments
are made. User scopes requested:

| Scope | Why |
|---|---|
| `channels:history` | public channel messages |
| `groups:history` | private channel messages |
| `im:history` | DMs — the highest-value source |
| `mpim:history` | group DMs |
| `users:read` | resolve author IDs to real names |
| `team:read` | `team.info`, for the workspace subdomain permalinks need |
| `chat:write` | the Tier 2 send action |

Slack user tokens do not expire unless token rotation is explicitly
enabled on the app. `SlackToken` therefore has no `expiresAt` and no
refresh grant — materially simpler than `GoogleHealthToken`, which needs
a refresh dance on every sync.

## 3. Schema

Three changes, one migration:

- `ArtifactSource` += `slack`. Everything downstream (`Artifact`,
  `ConnectorCursor`) keys off this enum, so this one value unlocks the
  existing connector machinery.
- `IdentityKind` += `slack`. Maps Slack user IDs (`U04AB…`) to `Person`,
  exactly as the existing `github` kind does.
- `SlackToken` model, mirroring `GoogleHealthToken` and reusing
  `EncryptedTokenValue` so the graph layer stores tokens opaquely and
  never holds `TOKEN_ENCRYPTION_KEY`:

```prisma
model SlackToken {
  id          String   @id @default(uuid())
  userId      String   @unique @map("user_id")
  accessToken Json     @map("access_token")
  teamId      String   @map("team_id")
  slackUserId String   @map("slack_user_id")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@map("slack_token")
}
```

`teamId` is stored because permalink construction (§4) needs the
workspace domain, and `slackUserId` so ingest can tell the user's own
messages from everyone else's without an extra API call.

## 4. Ingest

`packages/integrations/src/slack/{api,sync}.ts`, wrapped in
`runIntegrationSync` so cursor status transitions and error capture come
free — the same shape as `google-health/sync.ts`.

The loop: `users.conversations` enumerates every channel and DM the user
belongs to, then `conversations.history` pages each one with `oldest` set
from the stored cursor. `ConnectorCursor.cursor` holds:

```json
{ "channels": { "C04AB": "1723680000.123456" } }
```

Per-channel resumability means a failure mid-sync does not re-ingest
everything on the next run.

Each message becomes one `Artifact`:

| Field | Value |
|---|---|
| `externalId` | `${channelId}:${ts}` — satisfies the existing `@@unique([userId, source, externalId])`, so re-syncs are idempotent |
| `occurredAt` | `ts` epoch seconds → `Date` |
| `excerpt` | message text, truncated to 2000 chars |
| `url` | `https://<team>.slack.com/archives/<channel>/p<ts sans dot>` |
| `authorPersonId` | resolved via `Identity{kind: slack, value: <user id>}` |

The permalink is **constructed, not fetched**. `chat.getPermalink` would
cost one API call per message against the rate limit and returns a
deterministic string we can build ourselves.

Skipped message types: those with a `subtype` (joins, leaves, topic
changes) and those with empty text. They carry no commitment and would
pollute the eval set that extraction is later built against.

**Rate limiting.** `conversations.history` is Slack Tier 3 (~50/min). The
API client honours `Retry-After` on HTTP 429 and retries, bounded, rather
than failing the whole sync.

## 5. Send — Tier 2

`packages/integrations/src/slack/actions.ts` exports `sendSlackMessage`,
following `github/actions.ts`. It calls `chat.postMessage` with an
explicit `channel` and `text`.

Per the user's decision this is an **arbitrary send** — any channel or
DM, not restricted to replying to a source message. That is the one shape
where a recipient is chosen rather than derived from an `Artifact`, so
the policy binding matters:

- Tier 2 by the design doc §8 table: outward-facing, **one tap, always**,
  not togglable.
- Both `channel` and `text` are fixed at approval time. The tap approves
  a fully-resolved payload, never a template the model fills in
  afterwards.
- This action is never eligible for unattended execution, including after
  Tier 1 autonomy is enabled. Nothing about hitting the extraction
  precision bar unlocks it.

The approval pipeline itself does not exist yet (same state as the GitHub
write actions), so `sendSlackMessage` ships as a callable function with
its policy tier declared, exercised by tests but not yet reachable from
an unattended path.

## 6. Testing

Following the repo's existing pattern: `fetchImpl` injection throughout,
no network in tests.

- **`slack-oauth`** — authorize URL carries the right `user_scope` and
  state; code exchange parses `oauth.v2.access`; Slack's soft failures
  (HTTP 200 with `{ok: false, error}`) surface as thrown errors, since
  that is the single most common way a Slack client silently misbehaves.
- **`slack/api`** — cursor pagination follows `next_cursor` to
  exhaustion; 429 honours `Retry-After`; `ok: false` throws.
- **`slack/sync`** — artifacts get the right `externalId` and constructed
  permalink; subtyped and empty messages are skipped; the cursor advances
  per channel; a second sync over the same history is a no-op.
- **`slack/actions`** — `chat.postMessage` receives the exact channel and
  text; `ok: false` throws.
- **routes** — unauthenticated requests 401; missing token 400; the
  callback rejects a state mismatch.

## 7. Environment

```
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
```

Redirect URI, registered in the Slack app config:
`https://headroom.apps.human-angle.com/api/v1/integrations/slack/callback`

Built via `resolveRequestOrigin`, so the same code works in dev and
behind the Azure Container Apps TLS-terminating proxy. Both variables
follow `GOOGLE_CLIENT_*` through `deploy.yml` into the container.

Unlike the Google client, this is a dedicated Slack app used by nothing
else — no shared-credential coupling to worry about.
