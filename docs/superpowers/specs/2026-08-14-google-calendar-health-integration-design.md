# Google Calendar & Google Health integration — design

Parent: `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md` (§4 source
list, §8 action tiers, §16 capability backlog).

## 1. Scope

Two new source integrations, both pure `CapacitySignal` writers:

- **Google Calendar** → `meeting_hours`, `free_hours`
- **Google Health** → `sleep`, `rhr`, `hrv`

Both share one Google OAuth connection (Clerk's existing `oauth_google` social
connection, already used for sign-in) with additional scopes layered on via
`createExternalAccount`.

**Out of scope, explicitly:**

- **Gmail.** Gmail needs real prose extraction (an LLM parse of email text
  into `owed_by_me`/`owed_to_me` commitments) plus an eval harness to clear
  CLAUDE.md's ≥90%-precision gate. Nothing like that exists yet anywhere in
  the codebase — GitHub's "extraction" is a 1:1 structural map (open PR →
  commitment), not a model call. Gmail is sized like a second GitHub-scale
  project and gets its own future brainstorm.
- **Scheduled sync.** Manual "Sync now" only, matching GitHub today.
  `runIntegrationSync` doesn't know or care who calls it, so a daily
  `TriggerEvent` (`schedule` type) can be layered on later with zero changes
  to the connectors themselves.
- **Voice conversation, capacity strip UI, Tier 2 one-tap** — all v1.5 items
  in the parent doc's phasing table, not touched here. This piece only makes
  `CapacitySignal` rows exist; nothing downstream consumes them yet either
  (`packages/engine-mcp/src/tools/state.ts` already notes capacity fields are
  absent from its return shape "because no connector produces them yet" —
  this spec removes that gap but doesn't wire consumption).

## 2. Prerequisite — Google OAuth scopes

Confirmed via Google's own developer docs (not the parent design doc's
`googlehealth.*` shorthand):

| Signal | Scope | Data type |
|---|---|---|
| `sleep` | `https://www.googleapis.com/auth/googlehealth.sleep.readonly` | `sleep` |
| `rhr` | `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly` | `daily-resting-heart-rate` |
| `hrv` | (same scope as `rhr`) | `daily-heart-rate-variability` |
| Calendar | `https://www.googleapis.com/auth/calendar.readonly` | — |

Both Health scopes are Restricted (Google privacy/security review), but that
review only gates >100 users or public launch — Testing-mode OAuth with an
allowlisted test user (the account building this) works today with no
review, no waitlist, no Premium tier. This was verified against Google's
About/Developer-Checklist/Data-Types/Scopes pages directly (2026-08-14); the
parent design doc's open questions §14.2–3 are resolved by this.

**Manual step, outside this codebase:** the Google Cloud OAuth client behind
Clerk's Google connection needs these scopes added to its consent screen, and
the Health API enabled on that project, before `additionalScopes` requests
will succeed. This is a Google Cloud Console + Clerk Dashboard action, not
code — call it out as the first implementation step, verified by hand before
writing the connector code that depends on it.

## 3. Connect flow

Mirrors `ControlsView.tsx`'s existing GitHub `connectGithub()` exactly — same
`useReverification` step-up, same `createExternalAccount` shape:

```ts
const createGoogleExternalAccount = useReverification(() => {
  if (!user) return undefined;
  return user.createExternalAccount({
    strategy: "oauth_google",
    additionalScopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
      "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    ],
    redirectUrl: "/controls",
  });
});
```

One connect button covers both Calendar and Health rows — Clerk has one
Google connection per user, and scopes stack onto it. `SOURCES` in
`ControlsView.tsx` already lists both `calendar` and `google_health` rows
(labels, colors) rendering as "Not connected yet" placeholders; this spec
wires their `connected` check (`user.externalAccounts` includes a `google`
account with these scopes) and adds two independent "Sync now" buttons, since
the two connectors sync separately even though they share one connection.

## 4. Token access

`src/lib/google-token.ts`, same shape as `github-token.ts`:

```ts
export async function getGoogleAccessToken(clerkUserId: string): Promise<string | null> {
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(clerkUserId, "google");
  return tokens.data[0]?.token ?? null;
}
```

Nothing stored or encrypted on our side — Clerk holds and refreshes the
token, read fresh on every sync, identical to GitHub's approach.

## 5. `packages/graph` addition — capacity signals

No `CapacitySignal` writer exists yet anywhere in the codebase. New module
`packages/graph/src/capacity-signals.ts`:

```ts
export function upsertCapacitySignal(input: {
  userId: string;
  kind: CapacitySignalKind;      // "sleep" | "rhr" | "hrv" | "meeting_hours" | "free_hours"
  value: number;
  unit: string;
  forDate: Date;                 // date-only
  sourceArtifactId: string;
}): Promise<CapacitySignalRow> {
  return prisma.capacitySignal.upsert({
    where: { userId_kind_forDate: { userId: input.userId, kind: input.kind, forDate: input.forDate } },
    create: { id: randomUUID(), ...input },
    update: { value: input.value, unit: input.unit, sourceArtifactId: input.sourceArtifactId },
  });
}
```

Upsert-by-`(userId, kind, forDate)` makes re-sync idempotent — no separate
dedup logic, no moving cursor pointer needed. Both connectors recompute a
trailing window each sync (proposed 7 days back) rather than tracking "new
since last sync," because wearables and calendar edits both backfill/change
after the fact.

## 6. Google Calendar connector

`packages/integrations/src/google-calendar/{api,sync}.ts`, wrapped in the
existing `runIntegrationSync` (source: `calendar`) — no changes to that
helper.

**`api.ts`** — raw fetch against Calendar API `events.list` for `[today - 7d,
today + 1d)` (need trailing days for `meeting_hours`/`free_hours` to settle
after last-minute changes; no forward window needed since capacity signals
describe days, not future load — forward capacity is a v1.5 concern per the
parent doc). Filter out declined (`attendees[self].responseStatus ==
"declined"`) and all-day events.

**`sync.ts`** per day in the window:
- `meeting_hours` = sum of event durations that day, in hours.
- `free_hours` = `max(0, WORKDAY_HOURS - meeting_hours)`, where
  `WORKDAY_HOURS = 9` (9am–6pm assumption in the user's stored `timezone`,
  flagged in review as invented rather than found — first real usage should
  correct it, not a config surface yet).
- One `Artifact` per day: `source: "calendar"`, `externalId: "2026-08-14"`
  (the date), `occurredAt`: that date, `excerpt`: `"6 events, 4.5h booked"`.
- Both signals for that day cite the same artifact.

No commitments, no entity resolution, no invalidation logic — this connector
only ever writes `CapacitySignal` + its backing `Artifact` rows.

## 7. Google Health connector

`packages/integrations/src/google-health/{api,sync}.ts`, wrapped in
`runIntegrationSync` (source: `google_health`).

**`api.ts`** — raw fetch against `users.dataTypes.dataPoints.list` for each
of `sleep`, `daily-resting-heart-rate`, `daily-heart-rate-variability`, same
7-day trailing window (device sync lag is the documented reason wearable
data arrives late).

**`sync.ts`** per day, per data type present:
- One `Artifact`: `source: "google_health"`, `externalId:
  "sleep:2026-08-14"` (data type + date), `occurredAt`: that date, `excerpt`:
  a human-readable value (`"7h 12m sleep"`, `"RHR 58 bpm"`, `"HRV 42ms"`).
- One `CapacitySignal` row (`sleep` | `rhr` | `hrv`) citing it.

Data types absent for a given day (e.g. no wearable worn) are skipped
entirely — no zero-value rows, since a missing signal is not the same claim
as a measured zero.

## 8. API routes

Two new routes, identical shape to the GitHub sync route:

- `src/app/api/v1/integrations/google-calendar/sync/route.ts`
- `src/app/api/v1/integrations/google-health/sync/route.ts`

Each: resolve the Clerk user → `getGoogleAccessToken` → call the connector's
`sync*` function with `now: new Date()` → return the sync summary. Auth
failures (`null` token) return the same "reconnect needed" shape GitHub's
route already established.

## 9. Testing

Following the GitHub connector's own test shape
(`packages/integrations/src/github/__tests__/{api,sync}.test.ts`):

- `google-calendar/__tests__/api.test.ts` — event-list parsing, declined/
  all-day filtering.
- `google-calendar/__tests__/sync.test.ts` — meeting/free-hours math,
  artifact + signal upsert, idempotent re-run.
- `google-health/__tests__/api.test.ts` — data-point parsing per type.
- `google-health/__tests__/sync.test.ts` — artifact + signal upsert per data
  type, absent-day skip behavior.
- `src/lib/__tests__/google-token.test.ts` — mirrors `github-token.test.ts`.

## 9a. Addendum (2026-08-14, post-implementation) — Health needs its own OAuth flow

§2–3's premise — one shared Google connection, Clerk stacks scopes onto it —
turned out wrong for Health specifically, discovered via live testing:
Google's Health API rejects any access token that carries a scope outside
its own family, including the baseline `openid`/`email`/`profile` scopes
Clerk bundles onto every Google connection. There is no way to get a
Clerk-managed token containing only Health scopes, and `getUserOauthAccessToken`
has no scope-selection parameter. Calendar is unaffected — its API tolerates
extra scopes on the token fine, so it keeps using Clerk exactly as specced.

Health instead gets its own OAuth flow, independent of Clerk's Google social
connection:

- New `GoogleHealthToken` model (`packages/graph`): `userId`, `accessToken`,
  `refreshToken`, `expiresAt`. This is the one exception to "Clerk holds
  every token, we store nothing" — Health's token is scoped to exactly the
  two Health scopes and nothing else, so it can't ride on Clerk's per-user
  social connection at all.
- `GET /api/v1/integrations/google-health/authorize` — redirects to Google's
  authorization endpoint directly (our own client_id/secret, not Clerk's
  managed flow), requesting only the two Health scopes, with a random
  `state` nonce in a short-lived httpOnly cookie for CSRF protection.
- `GET /api/v1/integrations/google-health/callback` — verifies `state`,
  exchanges the returned `code` for tokens via a raw POST to Google's token
  endpoint, upserts the row, redirects back to `/controls`.
- A refresh helper checked before every sync: if the stored access token is
  expired, use the stored refresh token to mint a new one before calling the
  Health API.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` move into this app's own env
  (previously only Clerk's dashboard held them).
- `ControlsView`'s Health row Connect button points at the new authorize
  route instead of Clerk's `reauthorize()`; its connected-state check moves
  from `approvedScopes` (Clerk) to whether a `GoogleHealthToken` row exists
  (passed down as a prop from the Controls page, same pattern as `sources`).

## 10. Explicitly not built here

- Anything that reads `CapacitySignal` rows (capacity strip, brief content) —
  this spec only makes the rows exist.
- Scheduled/cron sync.
- Gmail in any form.
- A configurable working-hours window (hardcoded 9–6 assumption, first thing
  to revisit once real data exists).
