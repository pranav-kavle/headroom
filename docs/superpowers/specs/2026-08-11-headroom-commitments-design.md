# Headroom — Commitments vs. Capacity

**Design doc · 2026-08-11**

---

## 1. Context

Headroom keeps its name and loses its domain. The freelancer-cashflow product — Plaid,
Safe-to-Pay, the tax-bomb projections — is dead. What survives is the architectural
principle: a deterministic engine does all arithmetic, the model may never override it,
and every output carries its provenance.

Now stale and to be rewritten or removed:

- `CLAUDE.md` — describes the cashflow product, the $3,650 canonical scenario, and a
  Demo Day that has been paused.
- `prisma/schema.prisma` — ~90% cashflow-specific.
- `packages/priority-engine-mcp/src/tools/*` — the six tools are financial. The package
  *shape* survives; its contents do not.

Aug 14 2026 Demo Day is explicitly **paused**, not cancelled. It is not a constraint on
this design.

---

## 2. Product definition

**Pitch.** Every commitment you've made lives in a different app, and none of them know
how much you have left in the tank. Headroom reads your email, GitHub, and calendar,
extracts every promise you've made with a citation to exactly where you made it, weighs
it against your real capacity, and tells you each morning what's actually at risk — with
the work already drafted.

**Wedge.** Commitments vs. capacity. Not "AI chief of staff," which has no evaluable
success criterion. The narrower claim is testable: *does Headroom know what you owe, and
is it right?*

**Success metric.** Commitments closed without you opening the source app. Not nudges
sent, not notifications delivered, not daily actives.

**Non-goals.**

- Not a to-do list. You never type a task into Headroom; it reads them from where they
  were actually made.
- Not a summarizer. It does not tell you what your email said.
- Not a wellness coach. Health data is a capacity constraint on planning, never a
  diagnosis, never a judgment, never a cause.
- Not a chat interface with your data. The default interaction is a brief, not a prompt.

---

## 3. The core rule — verifiable autonomy

This section governs everything below it. Where a later section conflicts, this wins.

1. **The engine computes. The model extracts and phrases.** No figure, date, duration,
   count, or score is ever produced by the model. All of them come from engine tools.
2. **Every claim carries provenance.** A statement about the user's life is only
   utterable if it traces to a stored `Artifact` with a quote, timestamp, and source
   link. No provenance, no claim.
3. **The model never chooses its own autonomy tier.** Whether an action may execute is
   decided by deterministic policy from the action's tier. The model proposes content;
   it does not grant itself permission.
4. **Voice is STT → text → engine → TTS.** Never speech-to-speech. A speech-to-speech
   model will speak a number nothing computed and leave no artifact to audit.
5. **When the engine cannot determine something, Headroom asks.** It does not guess and
   phrase the guess confidently. Uncertainty is surfaced, not smoothed.

Rule 2 is the product's actual defense. Confident wrong claims about your own life are
uniquely intolerable — you always detect them — so auditability is a feature, not
hygiene.

---

## 4. Sources & auth

| Source | Access | Purpose |
|---|---|---|
| **GitHub** | GitHub App or PAT + webhooks | Review requests, assigned issues, mentions, stale branches. Already-structured commitments |
| **Gmail** | Google OAuth | Promises made in prose. The hard extraction target |
| **Google Calendar** | Google OAuth | Capacity: meeting load, free hours, the pinch days |
| **Google Health** | Google OAuth (`googlehealth.*`) | Sleep, resting HR, HRV from a Fitbit Air. Capacity multiplier only |
| **Voice notes** | In-app capture → STT | Promises made out loud. The only route for these; no other source can see them |

**One Google OAuth client** covers Gmail, Calendar, and Health — one consent screen, one
token store, one review if it ever productionizes.

### Auth constraints, dated

- **`googlehealth.*` scopes are Restricted.** Production access requires Google's
  restricted-scope security review, with no published SLA. Start it early; it costs
  nothing to have in flight.
- **Gmail write scopes are also Restricted.** `gmail.compose` / `gmail.modify` are
  needed for Tier 1 draft actions and sit behind the same gate as `gmail.readonly`.
- **Testing-mode publishing status** permits restricted scopes with no verification, up
  to 100 test users, but **refresh tokens expire after 7 days**. This is the development
  path and it means a weekly re-consent. Surfaced in the UI as a reconnect prompt
  (see Account screen), not hidden.
- **Fitbit Web API sunsets 2026-09-30.** Do not build on it, even for a prototype.
  Build against the Google Health API (`/v4/users/me/dataTypes/{type}/dataPoints`).
  Schemas share zero field paths with Fitbit's, so there is nothing to port.
- Every data point from Google Health carries platform, device, and recording method —
  useful, since provenance is mandatory anyway.

### Rate limits & resumability

A backfill reads thousands of artifacts, so every connector is a throttled, resumable
job — not a loop.

- **GitHub:** 5,000 req/hr authenticated. Use GraphQL to cut round-trips; prefer webhooks
  over polling once backfilled.
- **Gmail:** per-user quota units, and a 90-day backfill of ~5,000 messages will hit them.
  Batch, and fetch metadata before bodies so cheap filtering happens first.
- **Google Health:** rate limits are **undocumented**. Assume they exist, back off
  exponentially, and log every 429.
- **Every connector stores a cursor.** A crashed or killed backfill resumes from its last
  committed artifact rather than restarting. This is not optional — the backfill will be
  re-run many times while extraction is being tuned.

### Open

Whether Google Health API access to one's own data requires Google Health Premium
(the Fitbit Air ships with a 3-month trial). Unverified. Blocks the capacity phase only.

---

## 5. The life graph

Postgres via Prisma. This replaces the cashflow schema entirely.

Every table below is scoped to its owning user with a direct `userId` column — the
graph is single-tenant per user, never shared, so this is enforced at the schema level
rather than derived through joins. Primary keys are `id String @default(uuid())`,
column/table names map to snake_case, and every foreign key is `onDelete: Restrict`
(matching the existing audit-chain models) — nothing in the life graph silently
cascades away.

```
Person            id, userId, displayName, primaryEmail?, githubLogin?, createdAt

Identity          id, userId, personId, kind (email|github|phone|spoken_name),
                  value, confidence
                  @@unique([userId, kind, value])

Artifact          id, userId, source (github|gmail|calendar|voice_note|
                  google_health), externalId?, occurredAt, authorPersonId?,
                  excerpt, url?, rawRef?
                  @@unique([userId, source, externalId])

Commitment        id, userId, direction (owed_by_me|owed_to_me), summary,
                  counterpartyPersonId, dueAt?, duePrecision (exact|day|week|vague),
                  status, confidence, sourceArtifactId, quote,
                  closedAt?, closedReason?, supersededByCommitmentId?

CommitmentEvent   id, userId, commitmentId, kind (created|restated|moved|
                  fulfilled|cancelled|superseded), artifactId, at

CapacitySignal    id, userId, kind (sleep|rhr|hrv|meeting_hours|free_hours),
                  value, unit, forDate, sourceArtifactId
                  @@unique([userId, kind, forDate])

Action            id, userId, tier (tier_1|tier_2|tier_3|tier_4), kind (string,
                  connector-defined — e.g. "draft_reply", "calendar_hold"),
                  commitmentId?, status (proposed|executed|approved|undone|
                  failed), payload, externalRef?, executedAt?, undoneAt?,
                  agentRunId

Label             id, userId, commitmentId, verdict (real|not_real|already_done),
                  labeledAt

ConnectorCursor   id, userId, source (same enum as Artifact.source), cursor
                  (json, connector-defined shape), status (idle|running|error),
                  lastSyncedAt?, errorMessage?, updatedAt
                  @@unique([userId, source])
```

`Commitment.status`: `open | at_risk | overdue | fulfilled | cancelled | superseded | rejected`

**`Commitment.direction` matters.** Promises you are *owed* are commitments too, and
they are the ones that silently rot. Surfaced as "Waiting on others."

**`Action.commitmentId` is nullable** — most actions resolve a specific commitment,
but triage/labelling (Tier 1) can act on an artifact without one yet existing.

**`Action.tier` is an enum, not a raw int.** Core rule 3 makes the tier the load-bearing
input to policy — a typed enum is checked at compile time everywhere §8's tiers are
branched on, instead of trusting every call site to pass a valid 1–4.

**`User.selfPersonId?`** points at the `Person` record representing the user
themself, created and enriched during onboarding. Without it, the engine has no way to
tell "I promised Maya" from "Maya promised me" — both are just artifacts authored by
some `Person` unless one of them is known to *be* the user.

### Surviving models from the current schema

Keep the agent-run audit chain — it is already the right shape for the Ledger:

- `User` — gains `selfPersonId?` (above)
- `TriggerEvent` → `AgentRun` → `AgentRunAttempt`
- `RecommendationOutcome` + `DetectionMethod` — feedback capture, feeds `Label`.
  Gains a required `commitmentId` — an outcome is always about a specific
  commitment's predicted resolution now that `Commitment` exists.
- `CheckIn` / `CheckInChannel` — reusable for brief delivery records. Gains an
  optional `commitmentId` — nullable because a check-in can be about an entire
  brief, not one commitment.

### Belief invalidation

Without this the graph rots within a month and the briefs go stale. All rules are
deterministic and engine-side, and none of them require caching a derived value —
each is computed at scan time from `Commitment` plus its `CommitmentEvent` history:

- **fulfilled** — a later artifact from the user to the counterparty containing the
  deliverable; or the linked PR merged; or the held calendar event occurred.
- **superseded** — a later commitment with the same counterparty and subject but a
  different due date. The superseding commitment is recorded via
  `supersededByCommitmentId`, not just described in `closedReason` text — per core
  rule 2, the replacement must be a traceable record, not prose.
- **cancelled** — explicit release by the counterparty.
- **stale** — due date passed by **7 days** with no supporting artifact either way.
  **Headroom asks rather than guessing.** Per core rule 5, an unresolvable commitment
  becomes a question in the brief ("did this ever happen?"), not a silent status change.
  7 days is a starting value to be tuned from real use, and it lives in engine config,
  not in a prompt.

---

## 6. Extraction & eval

**This is the moat and the main risk.** Everything else in this document is tractable
engineering; this is not.

### What counts

A commitment requires a **who**, a **what**, and a **when** with at least `vague`
precision. "I'll take a look" is not a commitment. "I'll send it Monday" is. "I'll get
to this soon" is a commitment with `duePrecision = vague` and must be treated as
lower-confidence, not promoted to a date.

### Entity resolution

"Maya" in a voice note = `maya.r@` in email = `mrodriguez` on GitHub. Resolved via
`Identity` records with confidence scores, seeded from calendar attendee lists and email
headers (the highest-signal, lowest-effort source), corrected by the user in the confirm
flow. Never merged silently above a confidence threshold — an incorrect merge corrupts
every downstream claim.

### The eval harness

Build it before tuning prompts. Precision is the product, so it must be measured.

- **Corpus:** the user's own last 90 days, from the backfill.
- **Labels:** produced by the onboarding confirm screen and the "this was wrong" tap in
  the Brief. The onboarding flow *is* the labeling session — it does not need to be a
  separate exercise.
- **Target: ≥90% precision** on `owed_by_me` extraction before any unattended action is
  enabled. Recall is secondary and deliberately so: a fabricated commitment costs trust
  permanently, a missed one costs little because the user still has their inbox.
- Report precision and recall per source. Gmail will be much worse than GitHub; they
  should not be averaged into one misleading number.

### Feeding the graph back into STT

Pass `Person` display names, repo names, and project names as a vocabulary boost
(Deepgram keyterms / Whisper initial prompt). This is the difference between voice
feeling accurate and feeling broken, and it is nearly free.

---

## 7. The deterministic engine

Stays an MCP server at `packages/engine-mcp/` (renamed from `priority-engine-mcp`). It
stays MCP because that is the *enforcement mechanism* for core rule 1 — the model calls
the engine as a tool, so it structurally cannot do the arithmetic itself.

Tools:

| Tool | Returns |
|---|---|
| `get_state(date)` | Open commitments, capacity signals, current load |
| `compute_load(window)` | Promised hours vs. available hours |
| `score_risk(commitmentId)` | `{ score, reasons[] }` — deterministic, ordered |
| `get_brief(date)` | Ordered brief items, each with reasons and citations |
| `get_action_policy(tier, kind)` | `allowed \| needs_approval \| forbidden` |
| `close_commitment(id, reason, evidenceArtifactId)` | Requires evidence |
| `record_label(commitmentId, verdict)` | Feeds the eval set |

**Risk inputs** (all deterministic): days until due; unresolved blocking dependencies;
working hours available before the due date, calendar-derived; capacity index from
sleep/HRV against the user's own baseline, applied as a **multiplier, never a stated
cause**; whether commitments to this counterparty have slipped before.

**Output contract:** `score_risk` returns ordered reason strings. The model may rephrase
them. It may not add reasons, drop reasons, or reorder them.

---

## 8. Action tiers & policy

| Tier | Contents | Policy |
|---|---|---|
| **1 — Private, reversible** | Draft replies to Drafts, calendar holds in free slots, email triage/labelling, GitHub issue labelling and assignment, approve lockfile-only dependency PRs | **Unattended.** Logged, undoable. Individually togglable |
| **2 — Outward-facing** | Send a drafted reply, decline or move a meeting, comment on a PR, close a PR, merge a PR | **One tap, always.** Not togglable — blanket send permission does not exist as a setting |
| **3 — Money & third parties** | Purchases, bookings, cancellations | **Prepared, never executed.** Off by design, not by configuration |
| **4 — Code** | Read a PR and draft review comments, fix trivial issues, push a branch | **Deferred.** See §14 |

Closing and merging a PR sit in Tier 2, not Tier 4, added 2026-08-14: neither
generates or pushes code, they only transition the state of a PR a human already
authored and reviewed — the same kind of outward-facing state change as commenting.
Tier 4's deferral is specifically about Headroom reaching into the codebase itself,
which these do not do.

Tier 1 autonomy is not optional polish — it is what makes Headroom something other than
a notification app. But it is only enabled once §6's precision bar is met.

**Undo.** Every Tier 1 action stores enough state to reverse itself (`Action.payload`,
`Action.externalRef`). Undo is a first-class path, not a best-effort.

**The Ledger** is the user-facing view of `Action` + `AgentRun`. Its headline claim —
*"All reversible. Nothing left this device without you approving it"* — must be literally
true, which is why Tier 2 has no toggle.

---

## 9. Voice

Push-to-talk only. No wake word, no always-listening, no background audio.

```
hold button → MediaRecorder → POST → STT → engine + model
                                              ↓
      play audio ← streamed TTS ← response text (+ cards on screen)
```

- **STT:** Deepgram Nova or Whisper on Groq, server-side. Not
  `webkitSpeechRecognition` — poor on names, flaky in standalone PWAs.
- **TTS:** Cartesia Sonic or ElevenLabs Flash, streamed so playback starts before
  generation finishes.
- **Latency to first audio:** 1.5–3s, dominated by graph reasoning, not by STT/TTS.
  Mitigated by handing the first sentence to TTS while the rest generates.

### Four iOS gotchas, all load-bearing

1. **Unlock the `AudioContext` in the same gesture handler that starts recording.** The
   TTS response arrives async, by which time the gesture context is gone. This is the
   most common bug in this exact flow.
2. **Safari's `MediaRecorder` emits `audio/mp4` (AAC), not `audio/webm;codecs=opus`.**
   Check `isTypeSupported()`; accept both server-side.
3. **The physical ringer switch can mute HTML audio.** Lever is
   `navigator.audioSession.type = 'playback'`; support varies by iOS version.
4. **No Screen Wake Lock on iOS Safari.**

### Speak the claim, show the citation

Voice carries the narrative; the screen carries the evidence. Voice alone hides errors
that a screen surfaces, which is in direct tension with core rule 2 — so voice output is
never the sole channel for a claim.

---

## 10. Surfaces & information architecture

**Installed PWA.** Next.js, added to the Home Screen. Web Push via VAPID gives
event-driven server-initiated notifications at no cost and with no Apple Developer
account.

Two hard requirements:

- Push only works when installed to the Home Screen (`display: standalone`).
- `Notification.requestPermission()` must be called from a click handler or iOS silently
  ignores it. Ask **after** the backfill has shown value, never before.

Known limitation: standalone PWAs are unavailable in the EU under the DMA. Not a
constraint for the current single user; a real one if it ships.

**Email digest** is the always-works fallback channel, same content, full citations.

### Destinations: three tabs

```
Brief (home)
├── capacity strip                    (works from calendar alone; health sharpens it)
├── needs-you commitments  → push →  Commitment detail
├── on-track, collapsed
├── mic button             → sheet →  Voice
└── avatar                → push →  Account

Commitments
└── all open, grouped overdue / this week / later, incl. "waiting on others"

Ledger
└── unattended actions, each with Undo
```

Voice is an overlay, not a destination — navigating *to* a place in order to talk is
backwards. Capacity is a strip, not a screen — the moment it gets its own tab with sleep
charts it becomes the wellness dashboard §2 forbids.

### Screens (11, prototyped in `prototype/headroom.html`)

Brief · active — Brief · all clear — Commitments — Commitment detail — Voice sheet —
Ledger — Sign up — Setup/connect — Backfill — Confirm — Account

**Brief · all clear is not an empty state.** Most days should be that screen, so it
carries content ("handled while you slept") rather than reading as broken.

**Confirm** doubles as the eval-labelling flow (§6).

**Account** centres on autonomy — the tier policy rendered as toggles, with Tier 2
showing "One tap" instead of a switch and Tier 3 showing "Off by design."

---

## 11. Architecture

**One deployment.** Splitting frontend and backend while there is exactly one client
buys CORS, token plumbing, two pipelines, and messier local dev for no benefit. The
existing Docker + GitHub Actions deploy stays.

What *is* separated is the **contract**, enforced by rule not infrastructure:

```
src/app/(app)/          PWA UI — renders props, holds no business logic
src/app/api/v1/…        the only client↔server surface
packages/contracts/     Zod schemas + inferred types, shared
packages/engine-mcp/    deterministic engine, MCP tools, tested
packages/graph/         Prisma + graph queries — the only Prisma importer
packages/connectors/    github · gmail · gcal · googlehealth
packages/tokens/        design tokens as plain JS objects
```

### The seven port rules

1. `/api/v1/*` route handlers only, versioned from the first commit.
2. No server actions for anything a future native client would need.
3. `packages/contracts` is the single source of truth. Zod runs unchanged in RN.
4. Design tokens as JS objects, not only CSS variables — RN's `StyleSheet` consumes the
   same file and the visual port stops being a redesign.
5. **Platform capabilities behind interfaces** — `NotificationChannel`, `VoiceSession`,
   `SecureStore`. Web-push and `MediaRecorder` now; APNs and `expo-audio` later. The
   port swaps implementations instead of rewriting call sites. Highest-leverage rule here.
6. Prisma imported only inside `packages/graph`.
7. The engine stays MCP.

Following rules 1–2 is also what keeps Capacitor viable, since Capacitor wants a
client-rendered surface talking to an API rather than server components.

### Port cost if the rules hold

| Target | Effort | Rewritten |
|---|---|---|
| Capacitor | 2–4 days | Nothing — shell, push plugin, audio session, TestFlight |
| React Native / Expo | 1–2 weeks | All UI (HTML/CSS is 0% portable to RN) |
| Swift | 3–5 weeks | All UI, plus loss of TS logic sharing |

~65% of the work is backend and never moves. Native becomes worth $99 when lock-screen
approve-from-notification is wanted; that is the only capability gap that touches the
product's core promise.

---

## 12. Teardown

**Delete:**

- All cashflow Prisma models: `BankConnection`, `BankAccount`, `Transaction`,
  `TransactionClassification`, `RecurringExpense*`, `ExpectedIncome*`, `TaxProfile`,
  `TaxRuleSet`, `TaxBracket`, `TaxDueDate`, `Plan`, `AllocationLine`, `Projection`,
  `PlanWarning`, `PlanInput*`, `GoalConfig`, `BucketTarget`, `AccountBalanceSnapshot`
- `src/lib/plaid.ts`, `src/app/api/plaid/*`, `src/components/ConnectBankButton.tsx`
- `plaid` and `react-plaid-link` dependencies
- All six tools in `packages/priority-engine-mcp/src/tools/`
- The cashflow landing page copy

**Keep:**

- `User`, `TriggerEvent`, `AgentRun`, `AgentRunAttempt`, `RecommendationOutcome`,
  `CheckIn`
- `src/lib/token-encryption.ts` — directly needed for GitHub/Google token storage
- `src/lib/auth.ts`, `src/lib/prisma.ts`, Clerk sign-in/sign-up routes
- `packages/priority-engine-mcp` skeleton — `server.ts`, `db.ts`, vitest config and
  setup — **renamed to `packages/engine-mcp`** per §7 and §11
- `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`

**Rewrite:** `CLAUDE.md`.

---

## 13. Phasing

Each phase exists to prove one thing. Do not proceed on a failed proof.

| Phase | Proves | Contents |
|---|---|---|
| **v0** | Extraction is good enough to trust | Backfill script, graph, extraction, entity resolution, eval harness, Confirm UI, CLI brief. No push, no voice, no actions |
| **v0.5** | The daily loop earns attention | PWA Brief + Commitments + detail, web push, 7am brief. Read-only |
| **v1** | It is not a notification app | Tier 1 actions, Ledger, undo. Voice capture in, TTS brief out |
| **v1.5** | Capacity adds signal | Google Health, capacity strip, Tier 2 one-tap, voice conversation |
| **v2** | — | Tier 4 decision (§14); Capacitor if lock-screen approve is wanted |

v0 has no UI beyond Confirm on purpose. If precision fails, no amount of client work
saves it — and the Confirm screen is needed regardless, because it is the eval harness.

**Scope note.** This document specifies the whole product. It is deliberately larger than
one implementation plan. The first plan covers **v0 only** — teardown, graph, connectors
for GitHub and Gmail, extraction, entity resolution, eval harness, Confirm UI, CLI brief.
Each later phase gets its own plan.

---

## 14. Open questions

1. **Tier 4 — does Headroom reach into the codebase?** Deferred by explicit decision on
   2026-08-11, not dropped. Coding agents are the most proven agentic capability that
   exists, and GitHub is already a source, so this is the strongest available lever. But
   it means a chief of staff with push access — a materially different trust posture than
   one that reads email. Revisit after v1.
2. **Do `googlehealth.*` scopes work in OAuth Testing mode?** The family is ten weeks
   old and Google sometimes special-cases scope families. Verify before relying on it.
3. **Does Google Health API access require Google Health Premium?** Blocks v1.5 only.
4. **Brief content and firing time.** Currently 7:00 AM with three at-risk items. This
   is a question about the user's day, not the stack, and should be answered from real
   use rather than decided now.
5. **"Show 9 more" on the Brief** needs a destination now that Commitments exists —
   deep-link into the Commitments tab, filtered.
6. **Account page length.** Long enough to want a second level of navigation.

---

## 15. Risks

**Extraction precision is make-or-break.** Nothing else matters if this fails. An app
that says "you promised Maya Thursday" and is right feels magical on a laggy webview; one
that is wrong twice feels broken at 120fps on native. This is why v0 ships no client.

**Belief rot.** Commitments that never close turn the brief into noise within a month.
§5's invalidation rules are not a later refinement — they are load-bearing from v0.

**Notification fatigue.** Precision failures are punished asymmetrically here. Two wrong
pings and the user mutes the app permanently. The all-clear screen exists partly to make
silence feel intentional rather than broken.

**Google API churn.** The Google Health API launched end of May 2026, its predecessor
sunsets 2026-09-30, rate limits are undocumented, and three data types work but are
absent from the public reference. Expect breakage in the capacity path.

**Weekly re-auth.** Testing-mode refresh tokens expire every 7 days. A tool whose value
is being reliably present at 7am cannot silently break weekly. Surface it as a reconnect
prompt and start the restricted-scope review early.

**A crowded field, honestly.** Limitless, Granola, Mem, Reflect, Sunsama, and Google and
Apple shipping this into the OS. "AI plus my data" is not a wedge. The defensible
position is the narrow claim in §2 plus the auditability in §3 — not breadth.

---

## 16. Capability backlog

Candidates, not committed scope. §4 remains the v0 source list; nothing here is built
until the §6 precision bar is met. Every write below still obeys §8's tiers — Tier 3
(money, bookings, third parties) is prepared and never executed regardless of whether an
API exists.

### Read

| Domain | Source | Effort |
|---|---|---|
| Travel status | Flight status/schedules (Duffel, Amadeus, AeroDataBox); hotel and fare search (Amadeus, Booking Demand) | Low |
| Own itineraries | Gmail confirmations, boarding passes, reservations — richer than any travel API, free once Gmail lands | Free |
| Transit | Google Maps Directions — travel time to the next meeting, "leave by". Pairs with the capacity strip | Very low |
| Weather | Any weather API. Plan-quality signal, never a diagnosis | Trivial |
| Deliveries | AfterShip / EasyPost / 17track, or parsed shipping mail | Low |
| Places | Google Places / Yelp — hours, open now, phone | Low |
| Events | Ticketmaster Discovery, SeatGeek | Low |
| Contacts | Google People API — highest-signal seed for §6 entity resolution | Low |
| Docs & notes | Drive, Dropbox, Notion | Low–medium |
| Health & fitness | Google Health (§4), Oura, Strava, Whoop | Medium |
| Bills | Plaid/Teller — subscriptions and bills as dated `owed_by_me` commitments | Medium |
| Movie showtimes | No public API exists | Closed |

### Act

| Domain | Capability | Tier | Effort |
|---|---|---|---|
| Email | Draft, send, label, archive, unsubscribe | 1 / 2 | Low |
| Calendar | Hold, move, decline, invite | 1 / 2 | Low |
| Tasks | Create, complete, reschedule | 1 | Trivial |
| GitHub | Comment, close, merge, label, assign, review, open PRs, push branches | 2 / 4 | Low |
| Slack / Teams | Post, schedule, set status, reply in thread | 2 | Medium |
| Trackers | Linear, Jira, Asana, Notion — create, update, comment, reassign | 1 / 2 | Low each |
| SMS & calls | Twilio — text or call a counterparty | 2 | Low |
| Flights | Duffel, Amadeus — real end-to-end booking | 3 | Medium |
| Hotels | Booking Demand, Expedia Rapid, Amadeus — partner approval needed | 3 | Medium–high |
| Restaurants | OpenTable, Resy — partner-only, no consumer path | 3 | Closed |
| Movies, retail, rideshare, delivery | Fandango, Amazon, Uber, DoorDash — closed to third-party purchase | 3 | Closed |
| Money movement | Stripe, Wise, PayPal payouts — heavy KYC, distinct risk class | 3 | High |

### The boundary

Read is a cheap, near-unlimited surface. **Writes are concentrated in productivity SaaS**,
plus three outliers: flights, hotels, and phone calls. Consumer commerce is structurally
closed to programmatic action, so §8's "prepared, never executed" is an availability fact
as much as a safety stance.

For closed domains, *preparing the artifact* captures most of the value with zero
integration: a booking link with date, time, and party size prefilled; a drafted email to
the venue; a calendar hold already placed. This is the default for anything in Tier 3.
