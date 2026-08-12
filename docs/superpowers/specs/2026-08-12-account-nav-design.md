# Account page, top bar, and bottom tab bar

Companion to `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`
(§10 Surfaces & IA, §14.6 "Account page length"). That doc specifies the
target IA; this doc covers building the first slice of it against the
current state of the repo, ahead of Brief/Commitments/Ledger existing.

## 1. Why now, and what's actually in scope

The design doc's phasing (§13) puts the PWA screens at v0.5+, but voice
capture already shipped ahead of that ordering for the Aug 14 demo. This
follows the same pattern: build the Account screen and the two nav shells
now, against real data where real data exists, without waiting for
Brief/Commitments/Ledger to be built.

In scope: `TopBar`, `BottomTabBar`, `/account`. Out of scope: `/brief`,
`/commitments`, `/ledger` — the tab bar renders those tabs but they go
nowhere yet.

## 2. Source of truth vs. gaps found

The prototype (`prototype/headroom.html`, screen 11, "Account") is the
visual reference. Two gaps between it and the current app, resolved as
follows:

- **No rendered entry point to Account exists anywhere in the prototype**,
  despite the design doc's §10 stating "avatar → push → Account." Resolved:
  add an avatar button, top-right, to the current home screen (`/voice`).
- **Only `/voice` exists as a real authenticated route today** — there is
  no Brief screen to host the avatar or the tab bar "for real." Resolved:
  mount both nav components on `/voice` as the de facto home shell for now;
  none of the three tabs render as "active," since `/voice` isn't literally
  Brief.

## 3. Data — real vs. stubbed

Per the core rule (§3 of the main design doc: no claim without provenance),
nothing renders a fabricated value. Concretely:

| Prototype element | Source | This pass |
|---|---|---|
| Name + email header | Clerk / `User.email` | Real. `User` has no `name` column, so the header shows email + initials derived from it — not the prototype's invented "Pranav Kavle." |
| Sources (Gmail/Calendar/GitHub/Google Health, sync status) | `ConnectorCursor` | Real. New `listConnectorCursors(userId)` in `@headroom/graph`. Iterates the 4 relevant `ArtifactSource` values; a source with no `ConnectorCursor` row renders **"Not connected"**, not a fabricated synced state. |
| Tier‑1 toggles (5 rows) | none | Stubbed: local `useState`, not persisted. Defaults mirror the prototype (all on except "Approve dependency PRs"). No `ActionPolicy` model exists yet — a real implementation needs one; noted as follow-up, not built now. |
| Tier‑2 / Tier‑3 rows | none | Static, no toggle — matches policy (§8 of main doc: tier 2/3 are never togglable). |
| Brief settings (time, push, email digest, standing rules) | none | Stubbed: static / local state, not persisted. |
| Voice settings (voice picker, read-aloud) | none | Stubbed: static / local state, not persisted. |
| Export / delete graph | none | Rendered, inert — no backend endpoint this pass. |
| Sign out | Clerk | Real — `useClerk().signOut()`. |

## 4. Components

**`src/components/nav/TopBar.tsx` + `TopBar.module.css`**
Two variants:
- `back` — chevron + label, navigates to a given `href`. Used by `/account`.
- `home` — avatar (initials) right-aligned, links to `/account`. Used by
  `/voice`.

**`src/components/nav/BottomTabBar.tsx` + `BottomTabBar.module.css`**
Brief / Commitments / Ledger, ported from the prototype's `.tabbar`/`.tab`
markup. Each tab takes `disabled` (renders dimmed, non-interactive) and the
bar takes an optional `active` tab id (none, for now). No mic FAB in this
pass — it belongs on Brief once that screen exists.

**`src/app/account/page.tsx`**
Server component, same auth-gate pattern as `voice/page.tsx`:
`getOrCreateUser()` → `redirect("/sign-in")` if signed out. Fetches
`listConnectorCursors(user.id)` and passes user + sources to `AccountView`
as props. No new `/api/v1` route — this follows the existing precedent
where a server component reads via `@headroom/graph` directly rather than
round-tripping through the API layer, which stays reserved for client-side
fetches.

**`src/components/account/AccountView.tsx` + `AccountView.module.css`**
Client component (`"use client"`) — the whole screen: head, Sources card,
autonomy tiers, Brief settings, Voice settings, Data, sign-out. CSS ported
from the prototype's `.card` / `.arow` / `.tog` / `.tier` / `.lockpill` /
`.warnpill` / `.guard` / `.danger` classes, rewired onto `--hr-*` tokens
(the same tokens `voice.module.css` already uses) rather than the stale
cashflow-companion palette in `globals.css`.

**`packages/graph/src/connectors.ts`**
```ts
export type ConnectorCursorRow = {
  id: string;
  userId: string;
  source: ArtifactSource;
  status: ConnectorCursorStatus;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  updatedAt: Date;
};
export function listConnectorCursors(userId: string): Promise<ConnectorCursorRow[]>;
```
Exported from `packages/graph/src/index.ts` alongside the existing
`users`/`artifacts` exports.

## 5. `/voice` changes

Wrapped with `TopBar` (`home` variant) above and `BottomTabBar` (all tabs
disabled) below the existing `VoiceRecorder`. Layout becomes a column:
fixed-height top bar, scrollable content, fixed-height tab bar — same
`--hr-canvas` background it already uses.

## 6. Error handling

- `/account` unauthenticated → redirect to `/sign-in` (existing pattern).
- `listConnectorCursors` returning zero rows is a valid, expected state
  (nothing connected yet) — rendered as "Not connected" per source, not an
  error.
- Disabled tabs and inert buttons (Export/Delete) render but do not attach
  navigation/click handlers that could produce a broken or dead-end
  interaction.

## 7. Testing

- `packages/graph/src/__tests__/connectors.test.ts` — `listConnectorCursors`
  returns rows scoped to `userId`, ordered consistently, matching the
  existing `users.test.ts`/`artifacts.test.ts` shape.
- `src/app/api/v1/__tests__/routes.test.ts` pattern doesn't apply here (no
  new API route). Add a smoke test for `/account` following whatever
  existing convention (if any) covers `voice/page.tsx`; if none exists,
  skip — don't introduce a new test pattern for one page.

## 8. Explicit non-goals this pass

- No `ActionPolicy` (or similar) model/migration for persisting Tier‑1
  toggles.
- No Brief/Voice-settings schema or persistence.
- No `/brief`, `/commitments`, `/ledger` routes.
- No Export/Delete backend.
