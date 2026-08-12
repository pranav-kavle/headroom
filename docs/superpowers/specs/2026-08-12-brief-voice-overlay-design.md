# Brief page and the shared voice overlay

Companion to `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`
(§10 Surfaces & IA) and to `docs/superpowers/specs/2026-08-12-ledger-commitments-design.md`,
which left `/brief` explicitly out of scope ("Brief still doesn't exist, so the
tab bar's Brief entry stays disabled"). This pass builds it, against the same
`Commitment` data Commitments already reads, and — because voice is meant to
be reachable from every tab per the design doc's §10 ("Voice is an overlay,
not a destination") and the prototype's every tabbed screen — also promotes
voice capture from its own page into a shared overlay mounted on all three
tabs.

## 1. Why now, and what's actually in scope

Commitments, Ledger, and Account are built. Brief is the last of the three
tab destinations and becomes the real home: `/` now redirects authenticated
visitors to `/brief` instead of `/commitments`, and the Brief tab in
`BottomTabBar` becomes a real link instead of the disabled placeholder.

Voice is folded into the same pass because building Brief without it would
leave the prototype's most consistent piece of chrome — the mic FAB present
on every tabbed screen — missing from the one screen (Brief) where it matters
most. In scope: `/brief`, enabling the Brief tab, and a `VoiceOverlay`
(FAB + sheet) mounted on Brief/Commitments/Ledger, replacing the standalone
`/voice` route. Out of scope: everything under §7 below.

## 2. Source of truth vs. gaps found

The prototype (`prototype/headroom.html`, screens 1/2, "Brief · active" and
"Brief · all clear") is the visual reference. Several blocks it shows have no
backing data yet, and are resolved the same way the commitments/ledger doc
resolved its own gaps — omitted, not stubbed:

- **Capacity strip** ("Committed load, this week", the progress bar). Needs
  Google Calendar data (`CapacitySignal`) — no calendar connector exists, no
  rows exist. Omitted entirely.
- **"Handled while you slept"** (all-clear state). Requires bucketing
  `Action` rows into an overnight window — no engine computes this, and in
  practice no `Action` rows exist yet regardless. Omitted.
- **Per-item violet "assist" block** (drafted reply, calendar hold, "2
  approved, 1 drafted"). Same rule the commitment-detail screen already
  follows: renders only if a real `Action` row exists for that commitment.
  None do yet, so needs-you rows on Brief are plain — title, status pill,
  counterparty and source — no drafts, no CTAs.
- **"Why it's at risk" reasons.** No scoring engine (design doc §7,
  `score_risk`) exists. Omitted, matching the commitment-detail screen's
  existing precedent exactly.
- **"Show 9 more" destination** (design doc §14, open question 5). No
  filtered/segment query param exists on `/commitments` today. Resolved:
  links to plain `/commitments` (defaults to the "All" segment). Revisit once
  `/commitments` supports a segment query param.
- **Mic FAB gesture.** The prototype labels the collapsed FAB "Hold", which
  could be read as the FAB itself being the push-to-talk trigger. Resolved:
  the FAB's gesture is a tap that opens the sheet; the existing hold-to-talk
  gesture stays inside the sheet, unchanged, on `VoiceRecorder`'s own button.
  Making the outer FAB itself start recording would mean relying on touch
  pointer-capture surviving a DOM/z-index change mid-gesture — extra risk for
  no real gain over what already works.

## 3. Data — real vs. omitted

| Prototype element | Source | This pass |
|---|---|---|
| Headline count, needs-you rows, on-track rows | `Commitment` (already fetched by `listCommitments`) | Real. No new query — `/brief` calls the exact same `listCommitments(userId)` Commitments already uses. |
| Needs-you filter (`owed_by_me` + `at_risk`/`overdue`), on-track filter (`owed_by_me` + `open`), waiting-on-others filter (`owed_to_me`, not closed) | `Commitment.direction`/`status` | Real, computed client-side. Extracted from `CommitmentsView`'s existing `matchesSegment`/`counts` logic into `src/lib/commitment-groups.ts` so Brief and Commitments share one definition instead of two independently-maintained copies. |
| Status pill label/color ("At risk", "Overdue") | `Commitment.status` | Real. Extracted from `CommitmentDetailView`'s existing `STATUS_LABELS`/`pillTone` into `src/lib/commitment-status.ts`, reused by both. |
| Capacity strip | No connector, no data | Omitted (§2). |
| "Handled while you slept" | No engine, no data | Omitted (§2). |
| Assist blocks / risk reasons | No `Action` rows, no scoring engine | Omitted (§2). |
| Mic FAB + voice sheet | `VoiceRecorder` (existing, unchanged) + new overlay shell | Real. Reachable from all three tabs instead of only `/voice`. |

## 4. Components

**`src/lib/commitment-groups.ts`**
```ts
export function isNeedsYou(c: CommitmentRow): boolean;
export function isOnTrack(c: CommitmentRow): boolean;
export function isWaitingOnOthers(c: CommitmentRow): boolean;
```
Pulled out of `CommitmentsView`'s `matchesSegment`/`counts`, which now import
from here instead of re-deriving the same direction+status combinations.

**`src/lib/commitment-status.ts`**
```ts
export const STATUS_LABELS: Record<string, string>;
export function pillTone(status: string): "red" | "amber" | "green";
```
Pulled out of `CommitmentDetailView`, which now imports from here.

**`src/app/brief/page.tsx`**
Server component, same auth-gate pattern as `commitments/page.tsx`. Fetches
`listCommitments(user.id)`, passes to `BriefView`.

**`src/components/brief/BriefView.tsx` + `.module.css`**
Client component ported from the prototype's `.eyebrow`/`.display`/`.sub`/
`.sec-head`/`.item`/`.item-top`/`.meta`/`.pill`/`.ontrack`/`.ot-row`/`.tick`
classes (minus `.cap`, `.assist`, `.reasons`, `.allclear`'s ledger CTA — all
omitted per §2), onto `--hr-*` tokens.

Three render states, computed from the one fetched array:
- **Zero commitments** — honest empty state, no sections (matches the empty
  states on Commitments/Ledger).
- **`needsYou.length > 0`** — headline `"{n} promises need you."` (singular
  form when `n === 1`), a "Needs you" section (title, pill, counterparty ·
  source — no assist block), then "On track".
- **`needsYou.length === 0`** — headline `"Nothing at risk."`, straight to
  "On track".

Both non-empty states share one sub-line:
`"{onTrack.length} on track. {waiting.length} waiting on others."` — real
counts, no per-state copy branching.

"On track" is capped at 3 rows (`.ot-row`, non-interactive — the prototype
shows no chevron on these) plus a "Show {n} more" row linking to
`/commitments` when the total exceeds 3.

**`src/components/voice/VoiceFab.tsx` + `.module.css`**
The collapsed floating mic button, ported from `.mic`/`.mic-hint`.
`position: fixed`, bottom-right, above the tab bar. Takes `onOpen: () => void`,
called on tap.

**`src/components/voice/VoiceSheet.tsx` + `.module.css`**
Scrim + bottom sheet shell, ported from `.scrim`/`.sheet`/`.grab`.
`position: fixed`, `max-width: 390px` to match `AppFrame`'s column width.
Takes `onClose: () => void`, called on scrim tap. Wraps children — no logic
of its own.

**`src/components/voice/VoiceOverlay.tsx`**
Composes `VoiceFab` + `VoiceSheet` around the existing `VoiceRecorder`
(unchanged — its hold-to-talk recording, transcript display, and
`/api/v1/voice/transcriptions` calls are untouched). Owns one `open` boolean.
This is the single import added to `brief/page.tsx`, `commitments/page.tsx`,
and `ledger/page.tsx`, alongside their existing `TopBar`/`BottomTabBar`.

**`src/components/nav/BottomTabBar.tsx`**
One-line change: the `brief` entry in `TABS` gains `href: "/brief"`, dropping
into the same `Link`-rendering branch Commitments/Ledger already use. No
other changes to the component.

**`src/app/page.tsx`**
`redirect(userId ? "/brief" : "/sign-up")`, changed from `/commitments`.

**Retired:** `src/app/voice/page.tsx`, `src/app/voice/voice.module.css`. The
`/api/v1/voice/transcriptions` route and `VoiceRecorder` component are
unaffected — only the standalone page shell goes away.

## 5. Error handling

- `/brief` unauthenticated → redirect to `/sign-in` (existing pattern).
- Zero rows from `listCommitments` is a valid, expected state (fresh user) —
  rendered as the empty state in §4, not an error.
- Visiting the retired `/voice` path 404s (no redirect shim) — no external
  link or bookmark to preserve for a single-user prototype.

## 6. Testing

- `src/lib/__tests__/commitment-groups.test.ts` — the three predicates
  against representative direction/status combinations, following the
  `stt.test.ts`/`media-format.test.ts` convention for non-trivial `src/lib`
  logic (`format.ts`/`initials.ts` stayed untested as pure one-liners; this
  is closer in shape to `stt.ts`).
- No new `@headroom/graph` accessor, so no additions to `commitments.test.ts`.
- No new `/api/v1` route, so no additions to `routes.test.ts`.
- No page-level smoke test — matches the existing precedent (none of
  Commitments/Ledger/Account/Voice have one).

## 7. Explicit non-goals this pass

- No capacity strip — no calendar connector, no `CapacitySignal` data.
- No "handled while you slept" section — no engine buckets `Action` rows by
  time of day.
- No assist/draft blocks or "why it's at risk" reasons on Brief's needs-you
  rows — no `Action` rows exist, no scoring engine exists.
- No filtered deep link for "Show N more" — plain `/commitments`.
- No drag-to-dismiss physics on the voice sheet — tap-scrim-to-close only.
- No redirect shim for the retired `/voice` path.
