# GitHub — reviewer-less open PRs and on-demand checking

**Problem.** Asked "are there any open PRs?", the deployed agent said no. Two
independent gaps caused this:

1. **Sync is manual.** GitHub data only exists in Postgres if the user has
   clicked "Sync now" ([src/components/controls/ControlsView.tsx](../../../src/components/controls/ControlsView.tsx)).
   There is no live-query tool and no scheduled job, so `get_state` can only
   ever report on however-stale a snapshot happens to be in the database —
   including "never synced at all."
2. **Reviewer-less authored PRs are invisible.** `Commitment.counterpartyPersonId`
   is non-nullable, so the sync's own-PR query only captures PRs that already
   have a `User` requested as reviewer
   ([packages/integrations/src/github/api.ts:45-58](../../../packages/integrations/src/github/api.ts#L45-L58)).
   A PR with no reviewer requested yet produces no `Commitment` and is
   dropped before an `Artifact` is even written.

This spec fixes both without a schema migration.

## Core rule alignment (design doc §3)

Every fact this change surfaces still traces to a stored `Artifact` — the
model never learns about a PR from a live-only, unpersisted fetch. The engine
still computes everything (counts, staleness, closed/open state); the model
only phrases what it's given. Triggering a sync remains a private, reversible,
unattended read of our own data — no third-party side effect requires gating,
so it carries no tier.

## Change 1: capture reviewer-less authored PRs as facts, not commitments

`GithubSyncCandidates` gains a second bucket alongside the existing
`authoredOpenPRs`:

```ts
interface GithubSyncCandidates {
  viewerLogin: string;
  viewerName: string | null;
  reviewRequested: GithubCandidate[];
  assignedIssues: GithubCandidate[];
  authoredOpenPRs: GithubCandidate[];               // unchanged: has a User reviewer
  authoredOpenPRsWithoutReviewer: GithubBarePR[];    // new
}

interface GithubBarePR {
  nodeId: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
}
```

`candidateFromAuthored` in `packages/integrations/src/github/api.ts` stops
discarding PRs with no `User` reviewer; it routes them into
`authoredOpenPRsWithoutReviewer` instead of returning `null`.

In `packages/integrations/src/github/sync.ts`, for each PR in that bucket:
find-or-create its GitHub `Artifact` (via the existing
`findArtifactBySourceExternalId`/`createArtifact` pair — unchanged logic),
but do **not** call `resolvePerson` or `createCommitment` — there is no
counterparty to name. Add the PR's `nodeId` to `seenExternalIds` regardless,
so the stale-commitment invalidation pass (which only iterates existing
open `Commitment`s) never wastes a `fetchGithubClosedStates` call checking
a PR that was, in fact, just seen open — this matters specifically for a PR
whose reviewer gets removed after its `Commitment` already exists: it moves
from the commitment bucket to the fact bucket, and without this it would look
"unseen" and trigger an unnecessary closed-state check.

`GithubSyncSummary` gains:

```ts
interface GithubSyncSummary {
  created: number;
  closed: number;
  openPRsWithoutReviewer: Array<{ number: number; title: string; url: string; createdAt: string }>;
}
```

`nodeId` is not exposed past `sync.ts` — matching the existing write tools,
which resolve GitHub's raw id server-side and never let the model see it
directly.

No new lifecycle or closing logic is needed for this bucket: each sync
reports whatever `authoredOpenPRsWithoutReviewer` currently contains, fresh.
A PR that's since been merged, closed, or given a reviewer simply won't be in
that list on the next sync — there is nothing to invalidate because nothing
persistent was ever asserted about its open/closed state beyond "it existed
as an artifact."

## Change 2: `check_github`, a new on-demand read/refresh tool

New file `packages/engine-mcp/src/tools/github-check.ts`, exporting one
`EngineTool`, added to the `engineTools()` list in
`packages/engine-mcp/src/tools/index.ts` alongside `githubActionTools`.

```ts
{
  name: "check_github",
  description:
    "Triggers a fresh GitHub sync and reports what changed, plus your own open PRs that have no reviewer requested yet (these aren't commitments, since they aren't owed to anyone). Call this whenever the user asks about open PRs or GitHub review status, before answering. Call get_state afterward for full owed_by_me/owed_to_me counts, which already include GitHub — this tool only adds the one thing get_state structurally can't: PRs with no counterparty.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  external: true,
  aboutUser: true,
  // No tier: this is a read of our own data plus a read-only GraphQL call
  // against GitHub (search/nodes) — nothing here is a third-party side
  // effect, so nothing here needs gating.
  handler: async (_input, context) => {
    if (!context.githubToken) {
      throw new Error("GitHub is not connected for this user.");
    }
    return syncGithub({
      userId: context.userId,
      token: context.githubToken,
      now: context.now,
      fetchImpl: context.fetchImpl,
    });
  },
}
```

`syncGithub` is imported directly from `@headroom/integrations`, matching how
`github-actions.ts` already imports `closeGithubPR`/`mergeGithubPR`/
`postGithubComment` directly rather than through injected context.

No changes to `EngineContext`, `get_state`, or the API route that builds
`EngineContext` — `context.githubToken` and `context.fetchImpl` are already
populated there for the existing write tools.

**Boundary with `get_state`:** `get_state` stays a pure read of whatever is
already in Postgres, with no external calls and no side effects — its
contract doesn't change. `check_github` is the only tool that talks to
GitHub for reading purposes, and it always writes through the same
`syncGithub` → graph path "Sync now" already uses, so provenance and the
stale-invalidation logic are identical whether a sync was triggered by the
button or by a question.

## Explicitly out of scope

- **No throttling/debounce** on repeated `check_github` calls. GitHub's
  5,000 req/hr authenticated GraphQL limit is far above anything a chat
  session would trigger; adding rate-limiting now is premature.
- **No schema migration.** `Commitment.counterpartyPersonId` stays
  non-nullable; `Artifact` already supports existing without a linked
  `Commitment`.
- **No scheduled/background sync.** Sync remains triggered — either by the
  "Sync now" button or by `check_github` — never on a timer.

## Testing

- `packages/integrations/src/github/__tests__/api.test.ts`: add cases for
  `authoredOpenPRsWithoutReviewer` — no reviewer at all, and a `Team`
  reviewer (still bare, per existing team-exclusion behavior).
- `packages/integrations/src/github/__tests__/sync.test.ts` (or wherever
  `syncGithub` is tested): a bare PR produces an `Artifact` but no
  `Commitment`; a PR moving from reviewed to bare doesn't trigger a spurious
  closed-state check; `openPRsWithoutReviewer` is reported in the summary.
- New `packages/engine-mcp/src/tools/__tests__/github-check.test.ts`:
  not-connected throws the expected message; a successful call returns the
  sync summary verbatim; tool is registered with `external: true`,
  `aboutUser: true`, and no `tier`.
