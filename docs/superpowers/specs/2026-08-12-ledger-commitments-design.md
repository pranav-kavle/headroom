# Commitments list, commitment detail, and Ledger

Companion to `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`
(§10 Surfaces & IA) and to `docs/superpowers/specs/2026-08-12-account-nav-design.md`,
which this follows directly. That doc built Account + the two nav shells ahead
of Brief/Commitments/Ledger existing, with the tab bar pointing nowhere. This
pass builds Commitments (list + detail) and Ledger against the real
`Commitment`/`Action`/`AgentRun` tables, which the schema already models but
nothing reads yet.

## 1. Why now, and what's actually in scope

Both tables are already migrated and require no backfill to be readable: they
can legitimately be empty (a real new user has zero commitments and zero
actions until extraction/an engine exists) or non-empty (once one does). Per
the core rule (no claim without provenance), an empty table renders an honest
empty state, not a gap to paper over.

In scope: `/commitments` (list), `/commitments/[id]` (detail), `/ledger`, the
three new `@headroom/graph` accessors backing them, and enabling the
Commitments/Ledger tabs in `BottomTabBar`. Out of scope: `/brief` — Brief
still doesn't exist, so the tab bar's Brief entry stays disabled, and
commitment detail's only entry point is a row in the commitments list (the
prototype's "← Brief" back button becomes "← Commitments").

## 2. Source of truth vs. gaps found

The prototype (`prototype/headroom.html`, screens 3/4/6 — "Commitments",
"Commitment detail", "Ledger") is the visual reference. Two blocks in the
detail screen have no backing data model yet and are resolved as follows:

- **"Why it's at risk" reasons** — the prototype shows three bullets (blocked
  PR, meeting load, sleep debt). No deterministic scoring engine exists to
  produce these yet (design doc §14/§16 territory). Resolved: **omit the
  block entirely** this pass. Rendering placeholder or invented reasons would
  violate the provenance rule; there's nothing yet to disclose.
- **"Prepared action" draft block** — the prototype shows a drafted reply tied
  to the commitment. No draft-generation exists yet. Resolved: render this
  block only if a real `Action` row exists for the commitment (it won't,
  currently); omit otherwise. The component itself is agnostic to which case
  it's in — it just doesn't fabricate content to fill an empty case.

## 3. Data — real vs. stubbed

| Prototype element | Source | This pass |
|---|---|---|
| Commitments list header, counts, groups (Overdue/This week/Later), segments (All/Needs you/Waiting on others/Done) | `Commitment` + `Person` + `Artifact` | Real. Computed by filtering/sorting already-stored `status`/`direction`/`dueAt` — deterministic code, not model output. New `listCommitments(userId)`. |
| Commitments list search | Client-side substring match over the fetched list | Real and functional — no new API route, filtering happens in the browser over data the server component already fetched. |
| Commitment detail — header, Evidence block | `Commitment.quote`, `sourceArtifact.occurredAt`/`url`/`source` | Real. New `getCommitmentById(id, userId)`, scoped to the owning user; 404s otherwise. |
| Commitment detail — "Why it's at risk" reasons | No model | Omitted this pass (see §2). Explicit non-goal, not a stub. |
| Commitment detail — "Prepared action" draft | `Action` scoped to the commitment | Real if a row exists; block omitted otherwise. Nothing generates these rows yet, so it will be empty in practice. |
| Ledger entries, day grouping | `Action` + `AgentRun.startedAt` (`Action` has no own timestamp column) | Real. New `listActions(userId)`. |
| Ledger "Undo" | No undo endpoint | Rendered per the prototype, inert — no click handler. Matches the account page's Export/Delete treatment. |
| Bottom tab bar Commitments/Ledger entries | — | Enabled real links. Brief stays disabled — that route doesn't exist. |

## 4. Components

**`packages/graph/src/commitments.ts`**
```ts
export type CommitmentRow = Commitment & {
  counterpartyPerson: Person;
  sourceArtifact: Artifact;
};
export function listCommitments(userId: string): Promise<CommitmentRow[]>;
export function getCommitmentById(id: string, userId: string): Promise<CommitmentRow | null>;
```
Ordering for `listCommitments`: open/at_risk/overdue statuses before
fulfilled/cancelled/superseded/rejected, then by `dueAt` ascending (nulls
last). Grouping into Overdue/This week/Later and the segmented filter both
happen client-side in `CommitmentsView` over this one fetch — no separate
query per segment.

**`packages/graph/src/actions.ts`**
```ts
export type ActionRow = Action & { agentRun: Pick<AgentRun, "startedAt"> };
export function listActions(userId: string): Promise<ActionRow[]>;
```
Ordered by `executedAt ?? agentRun.startedAt` descending.

Both exported from `packages/graph/src/index.ts` alongside the existing
exports, each with a test file following `connectors.test.ts`'s shape.

**`src/app/commitments/page.tsx`**
Server component, same auth-gate pattern as `voice/page.tsx` and
`account/page.tsx`. Fetches `listCommitments(user.id)`, passes to
`CommitmentsView`.

**`src/components/commitments/CommitmentsView.tsx` + `.module.css`**
Client component. Header, search input, segmented control, grouped rows —
ported from the prototype's `.search`/`.segs`/`.seg`/`.grp`/`.crow`/`.cdot`
classes onto `--hr-*` tokens. Row tap → `Link` to `/commitments/[id]`. Empty
state: "0 open." plus a short honest note, no groups rendered.

**`src/app/commitments/[id]/page.tsx`**
Server component. `getCommitmentById(params.id, user.id)` → `notFound()` if
`null`. Passes the commitment to `CommitmentDetailView`.

**`src/components/commitments/CommitmentDetailView.tsx` + `.module.css`**
Client component. Header (status pill, title, "You promised/are owed by
{counterparty}"), Evidence block (quote, source line, "Open in {source}" link
when `artifact.url` is set). Reasons and draft blocks render conditionally
per §2/§3 — absent, not empty-with-placeholder. CSS ported from the
prototype's `.navbar`/`.who`/`.block`/`.quote`/`.src`/`.reasons`/`.reason`/
`.draft`/`.cta` classes.

**`src/app/ledger/page.tsx`**
Server component. Fetches `listActions(user.id)`, passes to `LedgerView`.

**`src/components/ledger/LedgerView.tsx` + `.module.css`**
Client component. Header ("N actions today."), timeline grouped by day
(Today/Yesterday/date), each entry showing what happened, its source
(`externalRef` or `kind`), and an inert "Undo" per §3. CSS ported from the
prototype's `.tl`/`.ent`/`.ent-t`/`.ent-a`/`.ent-m`/`.undo`/`.daybreak`
classes. Empty state: "0 actions today." with a short honest note.

**`src/components/nav/BottomTabBar.tsx`**
`TABS` gains an optional `href` per entry; Commitments and Ledger get one,
Brief doesn't. The component renders a `Link` when `href` is present,
otherwise the existing disabled/dimmed `div`. `active` continues to control
the highlighted state, passed by each page (`active="commitments"` /
`active="ledger"`); `/voice` keeps passing none, unchanged.

## 5. Error handling

- All three routes unauthenticated → redirect to `/sign-in` (existing
  pattern).
- `/commitments/[id]` for a missing or not-owned commitment → `notFound()`.
- Zero rows from `listCommitments`/`listActions` is a valid, expected state,
  not an error — rendered as the empty states in §4, not a fabricated list.
- The inert "Undo" button and the omitted reasons/draft blocks render but
  attach no handler/route that could produce a broken interaction, matching
  the account page's precedent for Export/Delete.

## 6. Testing

- `packages/graph/src/__tests__/commitments.test.ts` — `listCommitments`
  ordering/grouping-input correctness and `getCommitmentById` ownership
  scoping, matching the shape of `connectors.test.ts`.
- `packages/graph/src/__tests__/actions.test.ts` — `listActions` ordering and
  the `executedAt ?? agentRun.startedAt` fallback.
- No new `/api/v1` routes, so no additions to `routes.test.ts`.
- No page-level smoke tests, per the account doc's precedent (no existing
  convention covers `voice/page.tsx` either — not introducing one for one
  page).

## 7. Explicit non-goals this pass

- No risk-scoring engine — the "Why it's at risk" reasons block is omitted,
  not stubbed.
- No draft-generation — the "Prepared action" block only appears if an
  `Action` row already exists for a commitment, which nothing currently
  creates.
- No Undo backend — the Ledger's Undo control is inert.
- No seed script — ships with genuine empty states on a fresh account.
- No `/brief` route; the tab bar's Brief entry stays disabled.
