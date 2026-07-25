# Headroom — Pass 4: Implementation Readiness Review

*Independent implementation readiness review · generated 2026-07-16 · reviewer role: Principal
Engineer / Distinguished Solution Architect / TPM, no authorship stake in Passes 1–3*

**Method.** Every source document was read in full: `README.md`, `docs/onepager.md`,
`docs/PRD-v2.md`, `docs/personas.md`, `docs/hypotheses.md`, `docs/ai-agents.md`,
`docs/data-model.md`, and all three analysis passes. Pass 3 (`pass-3-implementation-backlog.md`)
is treated as the artifact under review; Passes 1–2 are treated as its inputs, not as pre-verified
truth — several of their self-assessed scores are re-examined below rather than inherited. The
repository's actual state (`git log --all`, full file listing) was checked directly rather than
taken from the backlog's own claims about program progress. All findings below cite the specific
line/section of the specific document they come from; nothing here is invented scope or
architecture.

**Revision note (2026-07-16, same-day update).** This review was updated after initial publication
to incorporate three developments surfaced in discussion after the first read: (1) a UI prototype
(`Headroom.html`) was added to the repo — verified directly, see §14; (2) the team intends
to build with heavy AI assistance, which changes the velocity assumption behind the 242-person-day
estimate in a way that isn't uniform across the backlog — see the revised §12 R-015; (3) a
consolidated epic/initiative hierarchy was requested and is now specified in §4. Every other finding
below is unchanged from the original pass and remains supported by the same cited evidence.

**Headline finding, stated up front:** the backlog itself is well-constructed — traceable,
consistently templated, honest about its own open decisions. The document set's *process* is not
where the risk lives. The risk is that, as of the original review, **this repository contained zero
implementation code**; a UI-only prototype has since been added (§14), which narrows but does not
close that gap — the deterministic engine, the orchestrating agent, all four MCP servers, the
schema, and every test/deploy/observability story are still unbuilt. The backlog estimates **~296
story points / ~242 person-days of task effort** across 8 sprints, and the plan asserts the program
is already in its fourth of eight weeks. Whether that effort figure is still the right number to
plan against — given AI-assisted development and the existing prototype — is addressed directly in
§12; the honest answer is "partially, and unevenly," not "no" and not "solved."

---

## 1. Executive Summary

Headroom's three prior passes did their job well at the level they operated: Pass 1
correctly inventoried the requirements and flagged real gaps; Pass 2 correctly reconciled Pass 1's
counting errors and drew a disciplined Track A/B/C boundary; Pass 3 correctly converted that
architecture into a traceable, FR-complete backlog with Given/When/Then acceptance criteria on
every one of 75 stories. Read as documents, they are unusually rigorous for a capstone project.

Read as an **execution plan**, three problems stand out that no prior pass caught, because each
pass trusted the one before it rather than re-verifying against ground truth:

1. **The schedule, as originally estimated, does not fit the remaining calendar.** ~242
   person-days of task effort remain against roughly 4.5 calendar weeks left before Demo Day
   (2026-08-14). A UI prototype now exists and the team plans to build with heavy AI assistance,
   both of which reduce this number — but not uniformly, and not enough to make the gap disappear
   without evidence. §12 gives a differentiated view of where the effort genuinely compresses and
   where it doesn't, plus a concrete way to find out fast rather than argue about it.
2. **Two genuine circular dependencies exist in the story graph** (ST-027 ↔ ST-031, ST-016 ↔
   ST-038), and one task is wired to the wrong prerequisite (ST-031-T3's windfall-smoothing logic
   depends on recurring-*expense* detection, not income-*cadence* classification). These are small
   fixes, but a team following the graph literally would stall or build in the wrong order (§6).
3. **The backlog's own process is oversized for the deliverable.** 11 initiatives → 37 epics → 50
   features → 75 stories → ~280 tasks, each carrying a full enterprise-grade template (Business
   Rules, Validation Rules, Error Handling, Security Considerations, Audit Requirements,
   Traceability), is a four-layer hierarchy applied uniformly down to 1-point documentation spikes
   (§9). For an 8-week, almost-certainly-small-team capstone, this is real authoring/maintenance
   overhead competing directly with the 4.5 weeks of build time the team doesn't have to spare.

None of this requires new architecture. The architecture (one agent, one deterministic engine,
four MCP sources, an append-only versioned ERD) is sound and this review does not revisit it. What
needs to happen before a team can execute with confidence is: reconcile the plan against actual
repo state, fix two dependency-graph defects, resolve two more open numeric decisions the backlog
left un-spiked, and make an immediate, explicit cut decision on Materiality Evaluator/Alert
Composer rather than waiting for schedule pressure to force it later.

---

## 2. Overall Health Score

| Dimension | Score (1–5) | One-line reason |
|---|---|---|
| Architecture | 4 | Sound, consistently enforced AI/deterministic boundary; small unresolved specification gaps (MCP deployment topology, two numeric thresholds) |
| Backlog structure | 3 | Excellent traceability, but a 4-layer hierarchy is disproportionate to project size, and 2 real circular dependencies exist |
| Story quality (INVEST) | 3 | Most stories are well-formed and testable; spikes are over-templated; one duplicated responsibility (ST-013 vs. ST-022); one priority-label contradiction |
| Task quality | 4 | Consistently sized and typed; one mis-wired dependency found, otherwise disciplined |
| Traceability | 5 | Every FR/BR/component/workflow independently re-checked in this review and found mapped; no coverage gap found |
| Testing | 3 | Good breadth, but accessibility coverage silently narrowed from 3 named surfaces (Pass 2) to 1 (Pass 3); a few named failure modes have no test |
| Security | 3 | Correctly scoped to demo-grade with real non-goals; the cheapest, highest-leverage guardrail (no-money-movement runtime assertion) was deferred to tech debt instead of built now |
| Operational readiness | 3 | Reset/replay and env separation are genuinely good; no deployment story for the 4 MCP servers as distinct deployables; no rollback story for a bad live deploy |
| Maintainability | 4 | Contract guard, shared MCP framework, and shared UI kit show real engineering discipline |
| Delivery confidence | 2.5 | A UI prototype exists and AI-assisted development plausibly compresses the mechanical half of the backlog hard — but the trust-critical half (tax math, waterfall, classifier calibration, evals, integration, dry runs) doesn't compress the same way, and nobody has measured actual velocity yet (§12) |

**Composite read: a well-designed plan the calendar cannot currently be *confirmed* to support.**
This is not an average-the-numbers score; it is a statement that the plan's quality and the plan's
feasibility are two different questions. The prototype and AI-assisted development are real,
positive updates to feasibility — but they're currently unmeasured optimism, not a validated
recalibration, and this backlog answers the quality question well and the feasibility question not
at all yet (see §13a: Pass 3 scored itself 4.5/5 without checking repo state).

---

## 3. Architecture Review

This review does not re-litigate Pass 2's architecture — it was sound then and remains sound.
Confirming, not repeating, its strongest properties: one orchestrating agent (ADR-001), one
deterministic engine (ADR-002), append-only versioning with full plan-input lineage (ADR-004/005),
and a clean Track A/B/C boundary that Pass 3 preserved without leakage (§14 completeness check
confirms zero Track C references in the buildable backlog — independently re-verified here and
found accurate).

**Gaps this review found that neither Pass 2 nor Pass 3 flagged:**

- **MCP server deployment topology is never stated.** `EPIC-27`/`ST-061` (pass-3, lines 3333–3376)
  covers deploying "the web app + headless runner." The four MCP servers (Aggregator, Tax-rule,
  Expected-income, Engine) have build stories (EPIC-13, 18, 19, 09) but no story ever states
  whether they run in-process inside the headless runner, as sidecar processes, or as independently
  deployed services. `ST-065` (shared MCP framework) implies a common scaffold but not a deployment
  model. This is a real architecture-coverage gap under Step 7's own test ("every component has
  ... deployment") — small to close, but currently unanswered.
- **No runtime assertion exists yet for "no tool call may initiate a transfer."** Pass 2 named this
  explicitly as a **[Recommendation]** (pass-2, line 916): "an explicit runtime assertion...would
  make this enforcement auditable rather than merely absent-by-omission." Pass 3 correctly captured
  it as `TD-06` (pass-3, line 4240) — but filed it as **deferred technical debt**, not a Track A
  story. Given that "the model never moves money" is the single most load-bearing trust claim in
  every source document (README, onepager, PRD §10, ai-agents.md), and `ST-066`'s contract guard
  already proves this pattern is cheap to build (a CI-blocking structural check), TD-06 should be
  promoted into Track A alongside ST-066, not left as someday-debt. This is the same class of
  guard, arguably cheaper, and closes a hole in the same trust boundary the backlog otherwise
  protects carefully.

---

## 4. Backlog Review (Hierarchy Validation)

**Nothing is orphaned.** Every story traces to a feature, every feature to an epic, every epic to
an initiative (independently spot-checked against §2–§5; confirmed accurate). **Nothing is
duplicated at the epic level.** But the hierarchy itself is oversized for the deliverable:

- **37 epics → 50 features is a ~1.35 features-per-epic ratio.** Scanning the feature catalog
  (pass-3 §4, lines 424–478), a majority of epics have exactly one feature (e.g., EPIC-08→FEAT-017,
  EPIC-17→FEAT-029, EPIC-19→FEAT-031, EPIC-21→FEAT-033, EPIC-25→FEAT-037, EPIC-28→FEAT-040,
  EPIC-29→FEAT-041, EPIC-31→FEAT-044, EPIC-32→FEAT-045, EPIC-33→FEAT-046 — 10 of 37 epics have a
  single feature that simply restates the epic). A Feature layer that is 1:1 with its parent Epic
  in over a quarter of cases is not decomposing anything; it is duplicate bookkeeping.
  **Recommendation:** collapse Epic and Feature into a single layer for this project's scale.
  Initiative → Epic → Story → Task (3 working layers) is enough; a 4th layer earns its keep only
  where an epic genuinely has 3+ independently schedulable features (EPIC-01, 03, 05, 07, 09, 11,
  12 qualify; most others don't).
- **Nothing is missing at the epic level** — independently checked every Pass 2 §6 component and
  every FR against the epic catalog; all present.

### 4.1 Consolidated hierarchy (requested, and applied)

Every one of the 37 epics was checked against its actual story count. **22 of 37 (59%) contain
exactly one story** — a one-story epic doesn't decompose anything; it's a label around a single
unit of work. The consolidation below keeps every one of the 75 stories and ~280 tasks completely
unchanged — it only removes redundant grouping layers, and it makes one scope call explicit (moving
Materiality Evaluator/Alert Composer to a clearly-labeled stretch epic, per §5/§13's existing
recommendation, rather than counting it in the must-build set).

| New Epic | Folds in (old epics) | Stories | Why |
|---|---|---|---|
| Onboarding, Goal Config & Confirm UI | EPIC-01 + EPIC-02 | ST-001–006 | Both are pre-plan interaction flows; EPIC-02 was only 2 stories |
| Safe-to-Pay Dashboard | EPIC-03 | ST-007–009 | Kept separate — the hero screen, reasonably sized alone |
| Orchestrating Agent & Triggers | EPIC-04 + EPIC-08 | ST-010–014, 026 | Expected-Income Interpreter is a 1-story skill invoked by a trigger EPIC-04 already owns |
| Transaction Interpreter | EPIC-05 | ST-015–017 | Kept separate — the flagship AI moment |
| Re-planner Pattern | EPIC-06 | ST-018–021 | Unchanged |
| Materiality & Alert Composer *(stretch, not must-build)* | EPIC-07 | ST-022–025 | Kept visible, relabeled stretch rather than merged, so the cut decision stays explicit |
| Engine Core: Tools, Tax & Waterfall | EPIC-09 + EPIC-10 + EPIC-11 + EPIC-17 | ST-027–035, 047 | These were already shown to have a circular dependency between EPIC-09 and EPIC-11 (§6) — merging makes the real coupling explicit instead of implying false independence |
| Income & Spend Forecasting | EPIC-12 | ST-036–040 | Kept separate — distinct concern, well-sized |
| Aggregator MCP & Demo Data | EPIC-13 + EPIC-14 | ST-041–043 | Personas are fixture data riding the aggregator interface |
| Core Schema & Lineage | EPIC-15 + EPIC-16 | ST-044–046 | Lineage tables are schema, not a separate concern |
| Reference & Supporting MCPs | EPIC-18 + EPIC-19 | ST-048–049 | Both small, single-story, seeded-reference-data MCP servers |
| Auth & Eligibility | EPIC-20 + EPIC-21 | ST-050–052 | Both gate who gets in and how |
| Output Generation (Dashboard API, PDF, Email) | EPIC-22 + EPIC-23 + EPIC-24 | ST-053–057 | All three read from the identical structured plan output — the source docs say this outright |
| Observability & Cost Controls | EPIC-25 + EPIC-26 | ST-058–060 | Both are run-level instrumentation |
| Deployment & Environments | EPIC-27 + EPIC-28 + EPIC-29 | ST-061–063 | All three are "keep the demo environment sane" concerns |
| Foundations & Guardrails | EPIC-30 + EPIC-31 + EPIC-32 + EPIC-33 | ST-064–069 | Repo/CI, the contract guard, the UI kit, and the 5 open-decision spikes are all day-1 scaffolding nobody uses directly |
| Automated Quality Gates | EPIC-34 + EPIC-35 | ST-070–071 | Both are CI-blocking correctness gates |
| Rehearsal & Security Verification | EPIC-36 + EPIC-37 | ST-072–075 | Both are pre-Demo-Day verification activities |

**Net:** 37 epics → 18 (17 if Materiality/Alert Composer's stretch epic is excluded from the active
count), 11 initiatives → 7 (grouping: User Experience; AI Orchestration & Skills; Financial Decision
Engine; Aggregator, Schema & Supporting MCPs; Platform — Auth, Observability, Deployment,
Foundations; Output Generation; Testing & Validation), Feature layer eliminated entirely (stories
attach directly to epics). This is a regrouping, not a scope change, with one exception already
called out above and in §13.

---

## 5. Story Review (INVEST)

Spot-checked all 75 stories in full (not sampled) against Independent/Negotiable/Valuable/
Estimable/Small/Testable. Most pass. The following are genuine, evidenced deviations:

**Duplicated responsibility — ST-013 vs. ST-022.** ST-013's acceptance criteria (pass-3, lines
1110–1111) include: *"Given two simultaneous material changes, when selecting what to surface,
then only the higher-consequence one is surfaced."* This is verbatim the job description of the
Materiality Evaluator, whose own eval case 3 (ST-022, lines 1538–1540) is exactly this scenario:
*"Given a tax gap and a minor expense occur the same day... the tax gap is surfaced (higher
rank)."* ST-013 is **P0/never-cut**; ST-022 (Materiality Evaluator) is explicitly **build-if-time**
per `ai-agents.md`'s own build-scope table and is the *first* thing the PRD's cut order removes
(PRD-v2.md §21: *"If schedule slips, cut in this order: Alert Composer → Materiality Evaluator..."*).
**If Materiality Evaluator is cut, ST-013 as written still claims to satisfy an acceptance
criterion that depends on Materiality's logic.** No fallback rule is specified for the cut
scenario. This is not a hypothetical — it is a P0 story's tested behavior resting on a component the
program's own pre-committed plan may remove. **Fix:** either state a simple deterministic fallback
inline in ST-013 (e.g., "if Materiality Evaluator is not built, surface the item touching a safety
floor/tax proximity first"), or explicitly note ST-013's boundary case (c) is void if ST-022 is
cut.

**Priority-label contradiction — ST-022/ST-023 vs. their own eval suites.** The backlog's priority
legend (pass-3, line 486–488) defines **P1 = "must-build but has a defined cut order."** ST-022 and
ST-023 (Materiality Evaluator, Alert Composer) are tagged **P1**. But `ai-agents.md`'s build-scope
table (lines 61–68) and Pass 3's own EPIC-07 description (line 179–181) call these skills
**"build-if-time"** — a materially different commitment than "must-build." Meanwhile their eval
suites, ST-024/ST-025, are tagged **P2 ("build-if-time")** — the *weaker* label, for the test suite
of a component the story-level tag calls stronger-than-build-if-time. A team skimming priority tags
under schedule pressure could reasonably build the skill (P1, "must-build") while skipping its own
eval suite (P2) — the opposite of what the trust-critical mismatch-check design intends. **Fix:**
retag ST-022/ST-023 as P2 to match the source docs' own "build if time" framing, and keep their
eval suites at the same tier as the skill they test, not one tier below it.

**Over-templated spikes.** ST-052, ST-054, ST-056, ST-068, ST-069 (1–2 points each) each carry the
full 13-field story template — including fields explicitly marked "n/a" for Validation Rules,
Error Handling, Security Considerations, and Audit Requirements. These are one-paragraph decisions
(the documents' own Definition of Done confirms this: *"a one-paragraph decision doc exists,"*
ST-052 line 2951). Five stories' worth of template overhead for what the backlog itself describes
as short design notes is process cost without corresponding value. **Fix:** convert these to a
single "Sprint 0 Decision Log" checklist item (5 sub-checkboxes), not 5 independently tracked
stories in their own epic.

**No stories found to be genuinely too large for their points.** ST-013, ST-015, ST-018, ST-029,
ST-031 (all 8 points, the scale's ceiling) each bundle multiple behaviors, but each behavior serves
one cohesive purpose (the orchestration loop; deposit classification; re-planning; tax computation;
the waterfall) and none would benefit from further splitting — this matches the scale's own top
tier being reserved for the hardest, most central work, which is appropriate, not a defect.

**No genuinely duplicate stories found** across the 75 — FR-20 mapping to three stories (ST-006,
ST-012, ST-026) is legitimate UI/backend/parsing decomposition of one requirement, not duplication.

---

## 6. Dependency Review

Pass 3 has no dedicated dependency-graph section (no critical path / circular dependency / blocked
work breakdown separate from the sprint narrative) — this is itself a gap against what a
sprint-ready backlog should include, and this review supplies the missing analysis.

**Circular dependencies found (2, both confirmed by direct text comparison):**

1. **ST-027 ↔ ST-031.** ST-031's story-level *Dependencies* line (pass-3, line 1959) lists
   `ST-027, ST-029, ST-036, ST-037`. But ST-027's own task table lists `ST-027-T3 —
   compute_allocation implementation (calls into ST-031's waterfall) | Dependencies: ST-031` (line
   1778). ST-027 cannot finish (task T3) until ST-031 is done; ST-031 cannot start until ST-027 is
   done. **Root cause:** `compute_allocation`'s tool *contract* (ST-027) and its *implementation*
   (ST-031's waterfall) were split into two stories/epics (EPIC-09 vs. EPIC-11) that are actually
   one unit of work. **Fix:** either merge ST-027-T3 into ST-031 (the waterfall story owns
   `compute_allocation`'s implementation; ST-027 owns only the tool signature/type contract), or
   explicitly sequence ST-027 (contract only, no T3) → ST-031 (waterfall, including what's now
   T3) → back to ST-027 for wiring — but the dependency graph as written is not a valid DAG.

2. **ST-016 ↔ ST-038.** ST-038's *Dependencies* (line 2280) list `ST-016`. But ST-016's task table
   lists `ST-016-T2 — New/changed-recurrence detection logic | Dependencies: ST-038` (line 1289).
   Same pattern: outflow classification (ST-016) and recurring-expense detection (ST-038) are
   mutually referenced. **Fix:** same pattern as above — these are two halves of one detection
   pipeline; sequence explicitly or merge the task.

Both cycles follow an identical shape (a task inside story A points forward into story B, while
story B's own header points back to story A) — this reads as a systemic authoring pattern (tasks
were written with the "deeper" implementation in mind before the parent story's own dependency line
was reconciled), not two unrelated one-off typos. **Recommend a single pass over all 75 stories'
task-level dependency columns checking each against its own story's header-level dependency line**
before sprint execution begins — the same defect may exist elsewhere and wasn't found by inspecting
every story in isolation the way Pass 3 built them.

**Mis-wired (non-circular) dependency found:** ST-031-T3, "Windfall-smoothing logic" (line 1974),
lists `Dependencies: ST-038`. But windfall smoothing is an **income-side** behavior — a $20k
deposit tagged `cadence=windfall` by the Transaction Interpreter (ST-015) must not be treated as
recurring pay (BRULE-004). ST-038 is **"Recurring expense detection & flagging"** — an
**outflow/expense-side** feature entirely about `RECURRING_EXPENSE` (rent, subscriptions). These
are unrelated domains that happen to share the word "recurring." An engineer following this
dependency literally would wait on expense-detection work that has nothing to do with the windfall
logic they actually need (ST-015's `cadence` field, surfaced via ST-036's income projection).
**Fix:** change ST-031-T3's dependency to ST-015/ST-036.

**Critical path (reconstructed, since Pass 3 doesn't state one explicitly):** ST-064/065 (repo, CI,
MCP framework) → ST-044/045 (schema) → ST-027/ST-031 (engine contract + waterfall, **circular as
currently written — fix first**) → ST-029 (tax) + ST-036/037/038 (forecasting) → ST-034/035
(reconciliation + structured output) → ST-013 (orchestrator) → ST-018 (re-plan) → ST-010/011/012
(3 triggers) → ST-058/059 (observability) → ST-071 (regression gate) → ST-063 (reset) → ST-072/073
(dry runs). This chain alone — before any UI, PDF, email, or build-if-time skill — is already ~10
of the backlog's highest-point, highest-risk stories run essentially sequentially.

**Parallel work correctly enabled:** the 4 MCP sources (Aggregator, Tax-rule, Expected-income,
Engine) can build concurrently once ST-065 lands; the 3 personas' fixture sets (ST-043's subtasks)
are independent; EPIC-01–03 (UI) can proceed against a mocked plan API behind ST-067's shared kit
without waiting on the full engine. Pass 3's sprint plan does exploit some of this (Sprint 1 mixes
UI, aggregator, and tax-rule work), which is a genuine strength.

**Blocked work:** correctly identified by Pass 3 itself — ST-051-T3, ST-023-T2, ST-055,
ST-010-T2/ST-011-T2 each wait on a Sprint-0 spike. This part of the dependency story is handled
well; no correction needed.

---

## 7. Sprint Review

Quantified directly from the backlog's own story-point tags (75 stories, 296 total points):

| Sprint | Week | Stories | Points | % of total |
|---|---|---|---|---|
| 0 | W1 | 13 | 46 | 16% |
| 1 | W2 | 9 | 40 | 14% |
| **2** | **W3** | **18** | **78** | **26%** |
| **3** | **W4** | **15** | **64** | **22%** |
| 4 | W5 | 6 | 21 | 7% |
| 5 | W6 | 7 | 30 | 10% |
| 6 | W7 | 6 | 24 | 8% |
| 7 | W8 | 5 | 15 | 5% |

**Sprints 2 and 3 alone carry 48% of the entire backlog's points in 2 of 8 sprints.** An even split
across 8 sprints would be ~37 points/sprint; Sprint 2 is more than double that. Pass 3 acknowledges
this is "the heaviest sprint by design" and adds it as new risk R-014 (line 4402), but the stated
mitigation — *"treat Sprint 2's completion, not its calendar week label, as the true gate"* — is
not a mitigation, it is a restatement of the risk. It does not reduce the work; it only permits the
schedule to slip further right, which cascades directly into Sprint 3 (also oversized) with no
slack sprint anywhere to absorb it.

**Is Sprint 0 through Sprint 7 realistic?** Not as currently balanced. Concrete recommendation:
rebalance by moving forecasting stories (ST-036–039, 22 points) from Sprint 2 into Sprint 1 (which
has slack — only 40 of an even-split ~37 baseline, i.e., already near-average) or a new thin
"Sprint 1.5," and move 2–3 of Sprint 3's UI stories (ST-008, ST-009, ST-006 — 10 points, lower risk
per their own Risk tags) into Sprint 4 (only 21 points, meaningfully under-loaded). This doesn't
reduce total work, but it removes the single worst point-concentration without inventing new scope.

**Recommend not merging or splitting sprints wholesale** — the 8-sprint/8-week alignment to the
PRD's own W1–W8 milestones is sound scaffolding. The fix is rebalancing points across existing
sprint boundaries, not changing the boundary count.

---

## 8. Missing Work

Beyond the dependency and priority defects already covered (§5, §6), concrete gaps found by this
review that neither Pass 2 nor Pass 3 flagged:

1. **No story reconciles the backlog against actual repo state.** Pass 3 states (line 4421–4423):
   *"the program is already mid-Sprint 3/W4... Sprint 0–2's stories may need a rapid retroactive
   audit against what's actually been built so far."* No story exists to perform that audit. Given
   this review's direct inspection found **zero implementation code in the repository** (§14), this
   is not a hypothetical nice-to-have — it is the first task any team must do, and it isn't on the
   backlog.
2. **No spike for the Transaction Interpreter's confidence threshold or the per-run cost ceiling
   value.** Both are flagged as **[Open decision]** in Pass 2 (§7, §13) and left as "implement
   behind a config flag, pick a placeholder" in ST-005/015 (line 738, 1230) and ST-059 (line
   3273–3274) respectively — the exact same category of unresolved-but-blocking decision that
   earned ST-054/056/068/069 their own spike stories. These two did not get spiked, and no default
   value is even proposed (contrast with ST-060's retry policy, which at least proposes "max 3
   attempts" as a concrete default). **Recommend two more 1-point spikes**, matching the pattern
   already established for the other four.
3. **No test for concurrent/racing triggers of different types for the same user.** ST-010/011's
   idempotency handling only covers a *duplicate delivery of the same logical event*
   (`idempotency_key`). Nothing addresses two *different* trigger types (e.g., a webhook and a
   manual-feedback message) arriving near-simultaneously for the same user and racing to write
   competing `PLAN`s. This is a real gap against Step 8's explicit ask about partial failures and
   concurrency, and against the engine's own determinism claims (a second concurrent
   `compute_allocation` call is not addressed by anything beyond the classification-row race test
   in ST-028).
4. **No database-connection-failure test**, despite Pass 2's own component table (line 318)
   specifying the required behavior ("Connection failure → Engine reports 'state unavailable,'
   agent does not proceed"). No story in Pass 3 (ST-027, ST-044, ST-045) turns this into a test
   task.
5. **No deployment story for the 4 MCP servers as distinct deployables** (§3) and **no rollback
   story for a bad live deployment** — EPIC-27/29 cover forward deploy and demo-data reset, but not
   "the last deploy broke the demo; roll back to the previous known-good build." Given Sprint 7 is
   the final week before Demo Day and treats any dry-run defect as "stop-ship" (line 3918), a
   deploy-rollback runbook is cheap insurance conspicuously absent from a plan otherwise careful
   about exactly this kind of risk (R-012's reset/replay logic is the same instinct, just not
   applied to deployment itself).
6. **Accessibility testing coverage was silently narrowed.** Pass 2 (§13, line 957) proposed
   accessibility checks on *"the dashboard, confirm-UI, and PDF"* — three named surfaces. Pass 3
   implements this as a task on exactly one story, ST-007-T4 (dashboard only, line 856). ST-005
   (confirm UI) and ST-053 (PDF) carry no equivalent task. This is a quiet drop of a Pass-2-approved
   requirement, not a documented scope cut.

---

## 9. Unnecessary Work / Overengineering Review

- **The 4-layer hierarchy (Initiative→Epic→Feature→Story→Task) is disproportionate** for what is,
  by every source document's own framing, an 8-week single-team capstone (§4). The Feature layer in
  particular adds bookkeeping without decomposition value in the 59% of epics where it's 1:1 with a
  single story. **§4.1 now specifies the applied consolidation** (37→18 epics, 11→7 initiatives,
  Feature layer removed) rather than leaving this as an unapplied recommendation.
- **The uniform 13-field story template applied to 1–2 point spikes** (§5) — five stories'
  worth of "Security Considerations: none new" / "Audit Requirements: n/a" boilerplate for what the
  backlog itself calls "a one-paragraph decision doc."
- **EPIC-33 as a standalone epic for 2 spikes (ST-068, ST-069)** plus 2 more spikes living in
  EPIC-21/EPIC-23 — the four/six open-decision spikes are scattered across three epics rather than
  grouped, adding navigation overhead for what is conceptually one "resolve these open questions"
  bucket of work.
- **Not overengineered, and worth explicitly defending:** the deterministic-engine boundary
  (ADR-002), the append-only lineage design (ADR-004/005), and the Orchestrator↔Engine contract
  guard (ST-066) are *not* overengineering — they are proportionate to the one failure mode
  ("a wrong number") every source document independently calls fatal. Do not cut these to save
  time; they are the cheapest insurance against the single named existential product risk.

---

## 10. Overengineering — see §9 (merged per template; both requested headings addressed together for concision)

---

## 11. Technical Debt Review

| Classification | Items | Rationale |
|---|---|---|
| **Fix before Demo Day** | Two circular dependencies (§6); ST-031-T3's mis-wired dependency (§6); ST-013/ST-022 duplicated-responsibility fallback (§5); ST-022/023 priority retag (§5); two missing spikes (confidence threshold, cost ceiling value) (§8); TD-06 (no-money-movement runtime assertion) promoted from tech debt into Track A (§3) | All are small, and each closes a real correctness or trust-boundary gap in code that's about to be built; cheaper now than after the waterfall/orchestrator are wired |
| **Can wait until Track B** | TD-07 (numeric retry/timeout tuning beyond the ST-060 placeholder); TD-05 (splitting the classification label enum into a `direction` discriminator) | Real, but only bites once real/high-volume non-scripted data arrives (Track B's whole purpose) |
| **Can wait until Track C** | TC-01…TC-16 as already scoped by Pass 3 §10.2 — this review found no reason to pull any of these forward, and confirms Pass 3's discipline here is correct | Legal/compliance/retention/billing genuinely gate on a real-user decision that hasn't been made |
| **Never worth fixing as a dedicated item** | TD-01 ("v3 Brief" wording fix) | Real but trivial; fold into any documentation PR that touches the PRD rather than tracking it separately |

---

## 12. Delivery Risks

Pass 3's risk register (R-001–R-014) is accurate and not repeated here except where this review
adds to it.

**R-015 [revised] — Effort/calendar mismatch, with AI-assisted velocity and the existing prototype
now factored in.** The original estimate: ~296 story points / ~242 person-days of task-level effort
(independently summed from the backlog's own per-task estimates) against roughly 4.5 calendar weeks
remaining to Demo Day (2026-08-14). Two things have since changed the picture, and this review's
job is to say plainly where they help and where they don't, rather than accept either the original
242-day figure or an optimistic "AI makes it much faster" claim without evidence:

- **What genuinely compresses hard:** schema/migrations (EPIC-15–16), MCP server scaffolding
  (EPIC-13/18/19/30), CRUD-shaped API endpoints, and UI components (EPIC-01–03/32) are
  boilerplate-shaped and well-specified by the ERD/contracts already in the docs — AI-assisted
  coding is genuinely strong here, and the newly-added UI prototype (§14) removes design ambiguity
  on top of that. A 3–5× compression on this portion (roughly 100–120 of the 296 points) is
  plausible.
- **What doesn't compress the same way, because the bottleneck was never typing speed:** the tax
  computation and canonical-scenario exact reproduction (ST-029/031/034/071) are gated by a
  verify-then-adjust loop — the number either equals $3,650 or it doesn't, and AI drafting the
  formula faster doesn't shorten the reconciliation cycle. Classifier calibration (ST-015/017) and
  eval tuning generally are gated by iterate-against-feedback, which has a human-judgment floor
  regardless of how fast the first draft is written. Cross-service integration and the dry runs
  (ST-072/073) are live rehearsals — they take as long as they take. External infra dependencies
  (Clerk/Langfuse/deploy — R-008) and the 6 open stakeholder decisions (§8, §13) aren't code at all
  and don't compress with coding velocity.
- **The honest position:** roughly the mechanical third-to-half of the backlog could plausibly
  compress a lot; the trust-critical half — which is also the half concentrated on the critical
  path identified in §6 — compresses much less. Splitting 242 days into "some fraction of this
  shrinks 3-5x, the rest barely moves" does not resolve to "the schedule is fine now," but it does
  mean the original flat 242-day, 4.5-week framing was too pessimistic in one direction, just as an
  unqualified "AI makes it much faster" claim would be too optimistic in the other.
- **Recommended resolution — measure, don't argue:** apply the project's own stated discipline
  (`hypotheses.md`'s own rule: *"stated intent doesn't count — a commit or an action does"*) to this
  question too. Build the schema + engine core (Sprint 0/early Sprint 2 critical-path stories) with
  AI assistance for a few real days, measure actual throughput against the estimates, and
  recalibrate the sprint plan from that data point — rather than trusting either the original
  per-task estimates or an assumed AI multiplier without a measurement behind it.

**Likelihood: Medium-High (down from High). Severity: Critical (unchanged) until measured.** This
remains the risk-register item that most determines whether the rest of this document matters on
schedule — it has moved from "almost certainly infeasible as scoped" to "unmeasured, and the
measurement is cheap and fast to get."

**R-016 [new] — High-risk-story concentration.** 24 of 75 stories (32%) are tagged Risk: High —
notably including nearly every story on the critical path identified in §6 (ST-013, ST-015, ST-018,
ST-029, ST-031, ST-034, ST-046, ST-050 is not but ST-063, ST-066, ST-071, ST-072, ST-073 all are).
A third of the backlog being high-risk, concentrated on the one sequential chain that gates
everything else, compounds R-015 rather than diversifying it.

---

## 13. Recommendations

1. **Immediately audit repository state against Sprints 0–2's ~40 stories** before planning any
   further work — the plan's own "mid-Sprint-3" framing does not match what existed in the repo at
   the time of the original review (§8, §14), and the UI prototype now added only covers a slice of
   EPIC-01–03. This is the first thing to do, not a nice-to-have.
2. **Spend a few real days measuring AI-assisted velocity on the critical path (schema + engine
   core) before trusting any calendar**, per the revised §12 R-015 — recalibrate the sprint plan
   from that number instead of arguing between the original 242-day estimate and an assumed AI
   multiplier.
3. **Cut Materiality Evaluator and Alert Composer now**, using the consolidated hierarchy's stretch
   epic (§4.1) rather than waiting for a forced cut later — Bar 5 is already satisfied by the three
   must-build skills (PRD §17), and reclaiming 30 points plus removing the ST-013/ST-022 duplication
   (§5) is a strict improvement available today at zero product cost.
4. **Fix the two circular dependencies and the one mis-wired dependency (§6) before Sprint 2
   begins** — cheap now, confusing later.
5. **Rebalance Sprint 2/3's point load (§7)** by moving ST-036–039 into Sprint 1 and 2–3 lower-risk
   UI stories from Sprint 3 into Sprint 4.
6. **Add the two missing spikes (confidence threshold, cost ceiling value)** to Sprint 0 alongside
   the existing four (§8).
7. **Promote TD-06 (no-money-movement runtime assertion) into Track A**, paired with ST-066, since
   it protects the same trust boundary at comparable cost (§3, §11).
8. **Adopt the consolidated hierarchy in §4.1** (37→18 epics, 11→7 initiatives, Feature layer
   removed) and **de-template the 5 spike stories into a single decision checklist (§5, §9)** — both
   are free schedule reclaims that cost nothing to product scope, only to process ceremony.
9. **Add the missing test tasks named in §8** (accessibility on confirm-UI/PDF, DB-connection
   failure, concurrent-trigger race, deploy rollback) — all are small, and each closes a gap the
   backlog itself already implicitly promised (via Pass 2's NFR list or the backlog's own
   completeness-check claims) but didn't deliver.

---

## 14. Go / No-Go Assessment

**Question asked: if this backlog were handed to a team of senior engineers tomorrow, what would
prevent them from immediately starting implementation?**

**Verified directly, not assumed:** at the time of the original review, this repository's entire
contents were the eight markdown documents reviewed here — `git log --all` showed only
documentation commits (`11baaf5` through `ad46b17`); there was no `package.json`, no `src/`, no
migrations, no CI config, no application code of any kind. Since then, one file was added:
`Headroom.html` (722KB, untracked) — direct inspection (its self-unpacking bundler
structure, and the near-total absence of any real backend/agent/MCP integration code inside it)
shows this is a **UI prototype/mockup**, almost certainly covering the dashboard and adjacent
screens (EPIC-01–03 territory), not a working implementation of the engine, agent, MCP servers,
schema, or infrastructure. Whatever "mid-Sprint-3/W4" means for the broader capstone program, **the
repository today is: one UI prototype, zero backend/agent/data-platform code.**

**Genuine blockers (would actually stop or seriously mislead a team starting tomorrow):**

1. **The schedule assumption is stale/misleading and must be explicitly discarded before any
   sprint planning.** A team reading "the program sits mid-Sprint 3" alongside a UI-only prototype
   would reasonably overestimate how much of Sprints 0–2 is actually done; nothing is hidden —
   the plan's own framing just hasn't been checked against the repo. This must be said out loud on
   day one, or the team will misjudge remaining runway.
2. **The effort/calendar question (§12, revised R-015) is now an open measurement, not a settled
   verdict in either direction.** A team *can* start Sprint 0's tasks literally tomorrow — the
   prototype and AI-assisted development are real, positive inputs — but nobody has yet measured
   actual AI-assisted throughput against the estimates on this codebase's actual hardest work (the
   tax/waterfall/classifier core). Planning the full 8-sprint calendar without that measurement
   means discovering the real number in week 6 instead of week 1.
3. **The two circular dependencies (§6)** would cause real confusion the moment a team tries to
   sequence ST-027/ST-031 or ST-016/ST-038 literally as written — small to fix, genuinely blocking
   if not fixed first.
4. **Eight open numeric/vendor/UX decisions** (four already correctly spiked in Pass 3 — email
   vendor, mismatch mechanism, negative-onboarding UX, duplicate-trigger behavior — plus two this
   review adds — confidence threshold, cost ceiling — plus, now, confirming what the newly-added
   prototype is actually wired to, if anything) gate a handful of P0 stories' Definition of Done.
   All are fast to close.

**Not blockers — explicitly, so none of this is mistaken for a redesign request:** the
architecture is not in question; the ERD is not in question; the Track A/B/C scope boundary is not
in question; the vast majority of the 75 stories are implementable exactly as written today.

**Recommendation: Conditional Go.** Code-level work (Sprint 0's foundational stories) can start
immediately — nothing here blocks that. But this backlog should **not** be treated as "ready to
execute against its stated 8-sprint calendar" until: the repo-vs-plan audit (§13.1) happens, a real
AI-assisted velocity measurement on the critical path replaces the flat effort estimate (§13.2), and
the two dependency-graph fixes (§13.4) land. None of these take more than a few days, and none
requires new architecture — but skipping them means finding out the real schedule the hard way,
in public, closer to Demo Day.

---

*End of Pass 4. This review revisits no architecture, ERD, or scope decision from Passes 1–3 except
where explicitly noted as a correction with cited evidence (§3, §5, §6, §8, §12, §14). Every finding
above cites the specific document and line/section it comes from; the repository's actual state was
verified directly via `git log --all` and a full file listing, not inferred from the backlog's own
narrative.*
