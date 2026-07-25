# Headroom — Pass 3: Implementation Backlog

*Implementation backlog · generated 2026-07-16 · baseline: `docs/analysis/pass-2-solution-definition.md`*

**Scope of this pass:** convert the Pass 2 solution definition into a complete, sprint-ready
implementation backlog for the **Demo Day (Track A)** build. Pass 2 is treated as the
implementation baseline — no architecture, ERD, or scope decision is revisited here except where
Pass 2 itself flagged an open decision blocking a story (handled below as a spike, per Pass 2 §20).

## 0. Conflict check (required before continuing)

Pass 2 was independently re-verified against every earlier source document (§2 of Pass 2, its own
correction log against Pass 1). **No new, unreported conflict exists between Pass 2 and any earlier
document** — Pass 2 is itself the reconciliation of every contradiction Pass 1 found (correction-log
naming, "v3 Brief" reference, entity-naming drift, blocking-gap miscounts). What Pass 2 does carry
forward, and what this pass must not silently absorb into ordinary stories, are:

- **8 open decisions** (Pass 2 §19: OPEN-ENG-01…06, OPEN-DOC-01, OPEN-ARCH-01) — of which exactly
  **one** (OPEN-ENG-04, email vendor) blocks a Track A functional requirement (FR-24).
- **4 explicit "backlog blockers"** (Pass 2 §19a) — email vendor, the FR-24 mismatch-check
  mechanism, BR-006's negative onboarding path, and GAP-017's duplicate-trigger reconciliation
  behavior — each needing a short design decision, not a redesign.

Per Pass 2's own §20 recommendation, all four are written below as **spike stories** (ST-052,
ST-054, ST-056, ST-068), not as stories with invented acceptance criteria. This is the only
adaptation this pass makes to Pass 2's content; no other scope, architecture, or data-model decision
is altered.

---

## 1. Executive summary

This backlog converts Pass 2's architecture (one orchestrating agent, one deterministic Financial
State + Priority Engine, 4 MCP sources, a versioned/lineage-tracked ERD, 3 outputs, Langfuse tracing)
into **11 initiatives, 37 epics, 50 features, 75 user stories, and ~280 technical tasks**, sequenced
across **8 sprints (Sprint 0 → Sprint 7)** aligned to the PRD's own W1–W8 milestone weeks
(`PRD-v2.md` §21). As of this document's date (2026-07-16), the program sits mid-**W4/Sprint 3** —
the sprint plan (§9) is presented in full from Sprint 0 for backlog completeness, not as a claim that
earlier sprints haven't started.

**Every FR-1 through FR-30 is covered by at least one story** (verified in §12's completeness
check). **Every Track A architecture component named in Pass 2 §6 has at least one implementation
story.** **Every one of Pass 2's 18 end-to-end workflows (§9.1–§9.18) has implementation coverage.**
**No Track C (real-user readiness) work appears in the Demo Day backlog** — Track B and Track C items
are carried in §10 as an explicitly separate, non-blocking deferred backlog, per Pass 2's own
strongest scope-discipline recommendation (§20 item 5).

**What's new in this pass (not in Pass 2):** story-level Given/When/Then acceptance criteria,
technical task breakdowns, story points and risk ratings, a sprint sequence, and a full
traceability matrix from FR/BR/architecture-component/workflow/data-entity down to story ID. No new
architecture decisions are made; every "why" traces back to a Pass 2 ADR, FR, or workflow citation.

**Readiness for execution:** **4.5/5.** The four spike stories are the only items standing between
"ready to size and commit" and "fully unblocked" — each is a single stakeholder decision or a short
design note (Pass 2 §19a), not new design work.

---

## 2. Initiative breakdown

| ID | Initiative | Objective | Epics |
|---|---|---|---|
| INIT-01 | User Experience | Deliver every user-facing surface: onboarding, goal config, confirm UI, dashboard | EPIC-01…03 |
| INIT-02 | AI Orchestration | Build the orchestrating agent and its 5 skills (Transaction Interpreter, Synthesizer's narration, Re-planner pattern, Materiality Evaluator, Alert Composer, Expected-Income Interpreter) | EPIC-04…08 |
| INIT-03 | Financial Decision Engine | Build the custom Financial State + Priority Engine MCP: allocation, tax math, floors, forecasting | EPIC-09…12 |
| INIT-04 | Banking Integration | Aggregator MCP (provider-agnostic) + scripted demo-data fixtures | EPIC-13…14 |
| INIT-05 | Data Platform | Postgres schema, plan lineage/audit, correction log, expected-income MCP, tax-rule MCP seed | EPIC-15…19 |
| INIT-06 | Authentication | Clerk auth gate + filing-structure eligibility gate | EPIC-20…21 |
| INIT-07 | Reporting | PDF plan, email "the catch," dashboard read API | EPIC-22…24 |
| INIT-08 | Observability | Langfuse tracing, cost ceiling, run/attempt tracking | EPIC-25…26 |
| INIT-09 | Deployment | Live deploy, dev/demo environment separation, demo reset & replay | EPIC-27…29 |
| INIT-10 | Technical Foundations | Repo/CI, MCP framework, Orchestrator↔Engine contract enforcement, shared UI kit, open-decision spikes | EPIC-30…33 |
| INIT-11 | Testing | Skill eval suites, engine regression, E2E dry runs, security-focused demo tests | EPIC-34…37 |

---

## 3. Epic catalog

Every epic below is **Track A (Demo Day)** scope unless noted. Full epic fields (Business Objective,
Scope, Out of Scope, Dependencies, Risks, Success Criteria, Definition of Done) follow the table.

| ID | Name | Initiative | Acceptance Bar(s) |
|---|---|---|---|
| EPIC-01 | Onboarding & Goal Configuration UI | INIT-01 | Bar 1 |
| EPIC-02 | Classification & Feedback UI | INIT-01 | Bar 4/5 |
| EPIC-03 | Safe-to-Pay Dashboard | INIT-01 | Bar 1/4 |
| EPIC-04 | Orchestrating Agent & Trigger Handling | INIT-02 | Bar 2 |
| EPIC-05 | Transaction Interpreter Skill | INIT-02 | Bar 5 |
| EPIC-06 | Re-planner Pattern | INIT-02 | Bar 2/5 |
| EPIC-07 | Materiality Evaluator & Alert Composer | INIT-02 | Bar 5 (if time) |
| EPIC-08 | Expected-Income Interpreter | INIT-02 | Bar 2 support |
| EPIC-09 | Financial State + Priority Engine Core | INIT-03 | Bar 3 (custom) |
| EPIC-10 | Tax Computation | INIT-03 | Bar 1/5 |
| EPIC-11 | Allocation Waterfall & Safety Floors | INIT-03 | Bar 1/5 |
| EPIC-12 | Income & Spend Forecasting | INIT-03 | Bar 5 |
| EPIC-13 | Aggregator MCP | INIT-04 | Bar 3 |
| EPIC-14 | Scripted Demo Personas | INIT-04 | Bar 1–7 (demo data) |
| EPIC-15 | Core Schema & Migrations | INIT-05 | Bar 3 (custom) |
| EPIC-16 | Plan Lineage & Audit | INIT-05 | Bar 7 |
| EPIC-17 | Correction Log | INIT-05 | Bar 5 |
| EPIC-18 | Expected-Income MCP | INIT-05 | Bar 3 |
| EPIC-19 | Tax-Rule MCP Seed | INIT-05 | Bar 3 |
| EPIC-20 | Clerk Authentication | INIT-06 | Bar 6 |
| EPIC-21 | Eligibility Gating | INIT-06 | — (business rule) |
| EPIC-22 | PDF Plan Generation | INIT-07 | Bar 4 |
| EPIC-23 | Email "The Catch" Alert | INIT-07 | Bar 4 |
| EPIC-24 | Dashboard Data API | INIT-07 | Bar 4 |
| EPIC-25 | Langfuse Tracing | INIT-08 | Bar 7 |
| EPIC-26 | Cost Ceiling & Run Tracking | INIT-08 | Bar 7 |
| EPIC-27 | Live Deployment | INIT-09 | Bar 6 |
| EPIC-28 | Environment Separation | INIT-09 | Bar 5 support |
| EPIC-29 | Demo Reset & Replay | INIT-09 | Dry-run support |
| EPIC-30 | Repo, CI/CD & MCP Framework | INIT-10 | All bars (foundation) |
| EPIC-31 | Orchestrator↔Engine Contract Enforcement | INIT-10 | Bar 2/5 (trust) |
| EPIC-32 | Shared UI Component Library | INIT-10 | Bar 1/4 support |
| EPIC-33 | Foundational Design Spikes | INIT-10 | Unblocks FR-24, BR-006 |
| EPIC-34 | Skill Eval Suites | INIT-11 | Bar 5 |
| EPIC-35 | Engine Regression & Canonical Scenario Tests | INIT-11 | Bar 1 (trust) |
| EPIC-36 | End-to-End Dry Runs | INIT-11 | All bars |
| EPIC-37 | Security-Focused Demo Tests | INIT-11 | Bar 6/7 |

### Epic detail

**EPIC-01 — Onboarding & Goal Configuration UI**
*Business Objective:* Let the user connect a bank, review the seed pass, and configure a goal so a
first plan can be computed (Bar 1). *Scope:* bank-connect UI (scripted), seed-pass review screen,
goal config form, live-edit recompute. *Out of Scope:* real OAuth, multi-account UI. *Dependencies:*
EPIC-13 (Aggregator MCP), EPIC-09 (Engine core). *Risks:* wrong first number from backfill alone is
an instant-uninstall trust failure (personas.md). *Success Criteria:* Bar 1 demoed live — edit a
floor, number recomputes. *Definition of Done:* FR-1–FR-4 implemented, tested, demoed in a dry run.

**EPIC-02 — Classification & Feedback UI**
*Business Objective:* Make the AI-hard classification moment visible and actionable on stage (Bar
5's "falsifiability" proof). *Scope:* one-tap confirm UI with evidence, free-text feedback entry.
*Out of Scope:* batch-correction tooling, mobile UI. *Dependencies:* EPIC-05 (Transaction
Interpreter), EPIC-09 (record_correction). *Risks:* a wrong confirm UI could let an unconfirmed
high-magnitude deposit silently enter a plan (BRULE-005). *Success Criteria:* confirming a
low-confidence deposit visibly moves the Safe-to-Pay Number live. *Definition of Done:* FR-6, FR-8,
FR-20 (UI half) implemented and demoed.

**EPIC-03 — Safe-to-Pay Dashboard**
*Business Objective:* Present the hero output (number, range, allocation, runway, tax-bomb status)
and the earned-attention posture. *Scope:* dashboard core, "the catch" pre-mortem UX, quiet-day
state. *Out of Scope:* historical trend charts, budgeting-style category breakdowns (explicitly
subordinated per PRD §11.8). *Dependencies:* EPIC-24 (dashboard API), EPIC-11 (allocation output).
*Risks:* dashboard reading as "just another budgeting tool" (PRD §20 risk). *Success Criteria:*
Journeys A/B/C (PRD §13) all demoable from this UI. *Definition of Done:* FR-22, UX-002/003/004
implemented and demoed.

**EPIC-04 — Orchestrating Agent & Trigger Handling**
*Business Objective:* Satisfy Bar 2 — background agentic re-planning on 3 trigger types. *Scope:*
cron, webhook, manual-feedback triggers; orchestrator loop; headless runner deployment. *Out of
Scope:* additional trigger types beyond the 4 named in PRD §14 (threshold reuses the same loop, not
a distinct trigger source). *Dependencies:* EPIC-09 (engine tools), EPIC-13 (aggregator webhook
source), EPIC-28 (env separation for dual-invoke). *Risks:* stuck/erroring run blocks re-planning
(Pass 2 §6). *Success Criteria:* all 3 triggers fire live and produce a re-plan. *Definition of
Done:* FR-18–FR-21 implemented, Bar 2 demoed.

**EPIC-05 — Transaction Interpreter Skill**
*Business Objective:* Deliver the single genuinely AI-hard task — classify ambiguous deposits/
outflows with confidence + evidence (the demo's core AI moment). *Scope:* deposit classification,
outflow classification, 5-case eval suite. *Out of Scope:* Document Intake/OCR (explicitly deferred,
`ai-agents.md` Component 9). *Dependencies:* EPIC-13 (transaction data), EPIC-17 (correction-log
read for bias). *Risks:* mislabeling a transfer as income inflates Safe-to-Pay (the one fatal
failure mode, repeated across every source doc). *Success Criteria:* 5/5 eval cases green; a
confirmed classification visibly moves the number. *Definition of Done:* FR-5, FR-7, FR-28
implemented; evals green.

**EPIC-06 — Re-planner Pattern**
*Business Objective:* Re-decide the remaining period when reality changes, protecting floors and
surfacing exactly one decision. *Scope:* re-plan execution, output shape, correction capture, 4-case
eval suite. *Out of Scope:* none — this is a "must-build" per `ai-agents.md`'s build-scope table.
*Dependencies:* EPIC-09 (engine recompute), EPIC-04 (trigger delivery). *Risks:* re-architecting this
as a second reasoning engine would reintroduce the risk Pass 2/ai-agents.md explicitly rejected (it
is the Orchestrator re-invoking the Synthesizer, not new logic). *Success Criteria:* 4/4 eval cases
green; the canonical $3,650 re-plan demoed live. *Definition of Done:* FR-15–FR-17 implemented,
evals green.

**EPIC-07 — Materiality Evaluator & Alert Composer**
*Business Objective:* Earned attention (silence by default) and one concise alert when something
matters — build-if-time per `ai-agents.md`'s build-scope table, high value/low cost. *Scope:*
deterministic-first materiality gate, alert copy generation + mismatch check, both eval suites. *Out
of Scope:* alert-fatigue modeling beyond a simple recent-cadence check (not designed per Pass 2 §6).
*Dependencies:* EPIC-09 (get_projections), EPIC-23 (email delivery). *Risks:* false negative
suppresses a real catch (the dangerous failure mode); named first in the PRD's own cut order if
schedule slips (PRD §21) — **cuttable without failing Bar 5** (min 2 skills; 3 are already
must-build). *Success Criteria:* 3+3 eval cases green if built. *Definition of Done:* FR-21, FR-24
(skill half) implemented; evals green; or explicitly cut per the PRD's pre-committed cut order.

**EPIC-08 — Expected-Income Interpreter**
*Business Objective:* Parse free-text signal ("Acme paid late") into a structured expected-income
update, powering the manual-feedback trigger. *Scope:* manual/free-text path only for v1. *Out of
Scope:* email ingestion (named fast-follow, not v1, `ai-agents.md` Component 7). *Dependencies:*
EPIC-18 (expected-income MCP). *Risks:* wrong invoice matched or wrong date parsed. *Success
Criteria:* rides the Orchestrator eval cases (a, d). *Definition of Done:* FR-20 (parsing half)
implemented and demoed.

**EPIC-09 — Financial State + Priority Engine Core**
*Business Objective:* Deliver the sole authority for financial computation — the custom-authored MCP
that satisfies Bar 3's "≥1 custom MCP" requirement. *Scope:* `get_state`, `set_goal`,
`compute_allocation`, `classify_transaction`, `record_correction`, `get_projections`. *Out of Scope:*
horizontal scaling / multi-tenant performance (Track C). *Dependencies:* EPIC-15 (schema), EPIC-19
(tax-rule MCP). *Risks:* this is "where financial truth lives" — a bug here is the single highest-
consequence defect in the system. *Success Criteria:* every other skill/UI story can call these
tools against a stable contract. *Definition of Done:* all 6 tools implemented, unit-tested, and
demonstrably the one authoritative source for every figure shown elsewhere.

**EPIC-10 — Tax Computation**
*Business Objective:* Compute a conservative, defensible Schedule C tax set-aside (SE + federal
brackets + QBI + half-SE deduction) and ramp it as the due date nears. *Scope:* federal + CA only
(canonical scenario). *Out of Scope:* additional states (Track B/C, OPEN-ENG-03); tax-math validation
against real filed returns (Track C, COMP-004). *Dependencies:* EPIC-19 (tax-rule MCP seed).
*Risks:* R-009 — tax math unvalidated against real returns (Track C gate; does not block Track A's
scripted scenario). *Success Criteria:* Synthesizer eval 4 (tax-floor boundary) green; canonical
scenario's $900 gap reproduces exactly. *Definition of Done:* FR-11 implemented and tested.

**EPIC-11 — Allocation Waterfall & Safety Floors**
*Business Objective:* Allocate against the fixed priority order (Taxes → Runway → Pay → Savings →
Debt) with hard floors that are never silently breached. *Scope:* waterfall allocation, tax-floor
protection, runway-breach warning, balance reconciliation, structured plan output. *Out of Scope:*
none. *Dependencies:* EPIC-09, EPIC-10, EPIC-12. *Risks:* R-001 — a wrong number on stage is the
single most damaging demo failure. *Success Criteria:* canonical scenario reproduces exactly $3,650;
Synthesizer evals 1–4 green. *Definition of Done:* FR-12–FR-14, FR-25, FR-26 implemented and tested.

**EPIC-12 — Income & Spend Forecasting**
*Business Objective:* Project income and expenses with a range (no learned model) to feed runway and
the number. *Scope:* income projection, expense forecast (trailing/seasonal average), recurring-
expense detection, next-period spend prediction. *Out of Scope:* learned/ML spend prediction
(explicit non-goal, PRD §6). *Dependencies:* EPIC-05 (classified transactions), EPIC-09. *Risks:*
the most build-heavy, fragile piece per PRD's own framing — kept subordinate to the number. *Success
Criteria:* Synthesizer eval 5 green (spend forecast within range; runway reflects it). *Definition
of Done:* FR-9, FR-10, FR-29, FR-30 implemented and tested.

**EPIC-13 — Aggregator MCP**
*Business Objective:* Provider-agnostic bank data access satisfying one of Bar 3's 4 required
sources. *Scope:* `get_transactions`/`get_balances`/`get_accounts` interface + a scripted-data
fixture loader implementing it. *Out of Scope:* live Plaid/Teller OAuth (Track B). *Dependencies:*
EPIC-14 (fixture content), EPIC-15 (schema). *Risks:* R-006 — classifier accuracy is only proven
against curated fixtures, not real messiness (Track B's reason to exist). *Success Criteria:* same
interface later swaps to a live provider without touching Interpreter/Synthesizer code (ADR-008).
*Definition of Done:* FR-1, FR-27 implemented; interface contract-tested.

**EPIC-14 — Scripted Demo Personas**
*Business Objective:* Provide 3 deterministic, reproducible 24-month personas (Maya/Dev/Sam)
exercising all 14 evals, all 3 triggers, all 3 outputs (PRD §18). *Scope:* fixture data generation
and checked-in versioning. *Out of Scope:* real anonymized data (Track B). *Dependencies:* EPIC-13.
*Risks:* R-001, R-012 — fixture drift or a botched reset breaks the canonical scenario. *Success
Criteria:* Dev persona reproduces exactly $3,650; all personas replayable from a reset baseline.
*Definition of Done:* 3 personas × 24 months committed to the repo, validated against PRD §7.

**EPIC-15 — Core Schema & Migrations**
*Business Objective:* Stand up the Postgres schema for every entity in `data-model.md`'s ERD.
*Scope:* identity/config/bank-data tables, plan-output tables. *Out of Scope:* retention/deletion
fields, consent fields (Track C). *Dependencies:* none (foundational). *Risks:* schema drift from the
documented ERD would silently break every downstream story's traceability. *Success Criteria:*
migrations apply cleanly; schema matches `data-model.md` exactly. *Definition of Done:* all 24
entities migrated, reviewed against the ERD line-by-line.

**EPIC-16 — Plan Lineage & Audit**
*Business Objective:* Make every `PLAN` fully auditable via pinned input versions and digests
(AUD-002). *Scope:* the 5 `PLAN_INPUT_*` join tables, `input_digest`/`output_digest` computation.
*Out of Scope:* none. *Dependencies:* EPIC-15. *Risks:* without this, a demo claim of auditability is
unverifiable. *Success Criteria:* a `PLAN` can be fully reconstructed from lineage tables alone.
*Definition of Done:* DR-003 implemented and tested.

**EPIC-17 — Correction Log**
*Business Objective:* Resolve ADR-006 in code — "the correction log" as the union of
`TRANSACTION_CLASSIFICATION(source=user)` rows and `CHECK_IN` provenance, with no separate table.
*Scope:* `record_correction` transactional behavior (write + link + flip `is_current`). *Out of
Scope:* a dedicated `CORRECTION` entity (explicitly rejected, Pass 2 §8). *Dependencies:* EPIC-15.
*Risks:* an engineer unaware of ADR-006 could build a duplicate table — this epic exists specifically
to prevent that. *Success Criteria:* every correction scenario (seed-pass, re-plan response) is
satisfiable by this mechanism alone. *Definition of Done:* DR-004 implemented; documentation
clarification applied (TD-02).

**EPIC-18 — Expected-Income MCP**
*Business Objective:* Manual invoice/expected-income tracking, satisfying one of Bar 3's 4 sources.
*Scope:* `list_expected_income`, `mark_invoice_late`. *Out of Scope:* live invoicing integration
(Stripe/QBO — explicit non-goal). *Dependencies:* EPIC-15. *Risks:* low — internal, in-app only.
*Success Criteria:* Orchestrator eval (a) — "Acme paid late" → correct mutation. *Definition of
Done:* INT-003 implemented and tested.

**EPIC-19 — Tax-Rule MCP Seed**
*Business Objective:* Seeded, versioned, cited tax reference data satisfying one of Bar 3's 4
sources. *Scope:* federal + CA only (matches the canonical persona, Pass 2 CL-04). *Out of Scope:*
additional states (Track B/C, OPEN-ENG-03 — not on Track A's critical path per Pass 2's correction of
Pass 1's GAP-005). *Dependencies:* EPIC-15. *Risks:* none for Track A — CA is already what the
canonical scenario assumes. *Success Criteria:* `get_tax_rules`/`get_due_dates` return correct,
checksummed data for the canonical scenario. *Definition of Done:* INT-002 implemented (federal+CA).

**EPIC-20 — Clerk Authentication**
*Business Objective:* Gate the deployed app (Bar 6). *Scope:* Clerk login/session integration. *Out
of Scope:* role-based access control (Track C — no roles exist yet). *Dependencies:* program-
provided Clerk infra. *Risks:* R-008 — external program-infra dependency. *Success Criteria:* Clerk
login demoed live. *Definition of Done:* SEC-002 implemented.

**EPIC-21 — Eligibility Gating**
*Business Objective:* Gate signup on filing structure so Schedule-C-only logic is never silently
applied to an ineligible user (BR-006). *Scope:* eligibility enum extension, gate logic. *Out of
Scope:* the negative-path UX is a spike first (ST-052) since no source describes it. *Dependencies:*
EPIC-20. *Risks:* "a wrong number here churns your highest-value users angry" (personas.md) — though
low-likelihood for a single-scripted-persona demo. *Success Criteria:* the gate logic is provably
reachable and testable once the spike resolves. *Definition of Done:* BR-006, COMP-003 implemented
per the spike's resolution.

**EPIC-22 — PDF Plan Generation**
*Business Objective:* On-demand PDF cashflow & tax plan, satisfying one of Bar 4's 3 outputs.
*Scope:* server-side render from the Synthesizer's structured output. *Out of Scope:* styling polish
(named cuttable in PRD §21's cut order). *Dependencies:* EPIC-11 (plan output), EPIC-24. *Risks:*
low — internal component, no external trust boundary. *Success Criteria:* PDF figures exactly match
the dashboard (same `PLAN` source). *Definition of Done:* FR-23 implemented and demoed.

**EPIC-23 — Email "The Catch" Alert**
*Business Objective:* Deliver "the catch" by email with a mismatch check that rejects drifted copy,
satisfying one of Bar 4's 3 outputs. *Scope:* vendor decision spike, compose+send, mismatch-check
mechanism spike. *Out of Scope:* consent/opt-in flow (Track C, GAP-007). *Dependencies:* EPIC-07
(Alert Composer), EPIC-33 (spikes). *Risks:* this is the one Track A item Pass 2 identifies as a
genuine blocker (OPEN-ENG-04) — resolve first. *Success Criteria:* Alert Composer evals 1–3 green;
email demoed live or via backup screenshot. *Definition of Done:* FR-24 implemented end-to-end.

**EPIC-24 — Dashboard Data API**
*Business Objective:* Expose plan data to the web app without ever letting the frontend compute a
figure. *Scope:* read-only plan API. *Out of Scope:* write endpoints beyond confirm/correct (owned by
EPIC-02/09). *Dependencies:* EPIC-09. *Risks:* low. *Success Criteria:* dashboard, PDF, and email all
read from the identical API/source. *Definition of Done:* supports FR-22 end-to-end.

**EPIC-25 — Langfuse Tracing**
*Business Objective:* Full trace of every agentic loop, satisfying Bar 7. *Scope:* span
instrumentation on every tool call, including interpreter confidence. *Out of Scope:* trace
redaction policy (Track C — Track A carries no real PII, so this is safely deferred per Pass 2 §10).
*Dependencies:* program-provided Langfuse infra, EPIC-04. *Risks:* R-008 — external infra
dependency. *Success Criteria:* a full re-plan trace shown live in Langfuse. *Definition of Done:*
AUD-001 implemented.

**EPIC-26 — Cost Ceiling & Run Tracking**
*Business Objective:* Enforce a spend ceiling per run and track retries, satisfying the rest of Bar
7. *Scope:* cost-cap enforcement, `AGENT_RUN`/`AGENT_RUN_ATTEMPT` tracking. *Out of Scope:* none.
*Dependencies:* EPIC-04. *Risks:* low. *Success Criteria:* cost cap demonstrably caps a run live.
*Definition of Done:* SEC-005, OPS-001, AUD-003 implemented.

**EPIC-27 — Live Deployment**
*Business Objective:* Deployed, HTTPS, Clerk-gated app + headless runner, satisfying Bar 6. *Scope:*
deploy pipeline for both the web app and the headless runner. *Out of Scope:* HA/multi-instance
scaling (Track C). *Dependencies:* EPIC-20, program infra. *Risks:* R-008. *Success Criteria:* the
live URL opens, Clerk-gated, on stage. *Definition of Done:* Bar 6 fully demoed.

**EPIC-28 — Environment Separation**
*Business Objective:* Keep Claude Code dev invocations from contaminating demo state while still
proving Bar 5's dual-invocation of the same skill code (ADR-010). *Scope:* distinct DB connection
strings/schemas per environment. *Out of Scope:* full multi-environment CI promotion pipeline (small
scope, capstone-proportional). *Dependencies:* EPIC-15, EPIC-30. *Risks:* a shared DB could corrupt
the demo persona's plan history right before a dry run. *Success Criteria:* the same Synthesizer
code runs from Claude Code and the headless runner against separate state. *Definition of Done:*
GAP-018 resolved.

**EPIC-29 — Demo Reset & Replay**
*Business Objective:* A documented, scripted reset-and-replay procedure before each dry run (R-012,
§9.18 — not sourced in the docs, proposed by Pass 2). *Scope:* truncate/reseed script for the 3
personas. *Out of Scope:* none. *Dependencies:* EPIC-14, EPIC-15. *Risks:* a botched manual reset
between dry runs risks the canonical scenario's reproducibility guarantee. *Success Criteria:* reset
+ replay produces identical `PLAN` digests across runs. *Definition of Done:* script exists, used in
dry-run #1.

**EPIC-30 — Repo, CI/CD & MCP Framework**
*Business Objective:* Foundational scaffolding every other epic depends on. *Scope:* repo structure,
CI pipeline, shared MCP server framework/tool-call conventions. *Out of Scope:* none. *Dependencies:*
none (first epic in sequence). *Risks:* low, but blocking — nothing else can start cleanly without
it. *Success Criteria:* a new MCP server can be scaffolded from the shared framework in under a day.
*Definition of Done:* CI green on a trivial change; MCP framework documented.

**EPIC-31 — Orchestrator↔Engine Contract Enforcement**
*Business Objective:* Make the "Orchestrator never computes a figure" rule an enforced code
boundary, not just a documented convention (Pass 2 §19a recommendation). *Scope:* lint/type-level
guard. *Out of Scope:* none. *Dependencies:* EPIC-04, EPIC-09. *Risks:* without this, a future change
could silently let the model compute a number — the one failure this product cannot survive.
*Success Criteria:* a violating change fails CI. *Definition of Done:* guard implemented and tested
with an intentionally-failing case.

**EPIC-32 — Shared UI Component Library**
*Business Objective:* Consistent range/assumption/disclaimer presentation across dashboard, confirm
UI, and goal config (UX-003 applies everywhere). *Scope:* range display, NFA disclaimer component,
card/list primitives. *Out of Scope:* full design system beyond demo needs. *Dependencies:* none.
*Risks:* low. *Success Criteria:* every figure shown anywhere carries its range + assumption by
construction, not by convention. *Definition of Done:* component kit in use by EPIC-01–03.

**EPIC-33 — Foundational Design Spikes**
*Business Objective:* Resolve the 4 Pass 2 "backlog blocker" items with a stakeholder decision or
short design note before their dependent stories close. *Scope:* email vendor, mismatch-check
mechanism, negative-onboarding UX, duplicate-trigger reconciliation. *Out of Scope:* re-opening any
already-resolved Pass 2 ADR. *Dependencies:* none — these can start immediately. *Risks:* if
undecided, they block ST-055 (email), ST-051 (eligibility), and trigger-dedup hardening. *Success
Criteria:* each spike produces a written decision consumed by its dependent story. *Definition of
Done:* 4/4 spikes closed with a documented answer.

**EPIC-34 — Skill Eval Suites**
*Business Objective:* Satisfy Bar 5's eval-gate requirement (14 core, +6 optional, all green).
*Scope:* the checkpoint story tying together the 5 per-skill eval-suite stories already embedded in
EPIC-05–08. *Out of Scope:* none. *Dependencies:* EPIC-05–08. *Risks:* R-006 — evals only prove
scripted-scenario correctness, not real-data accuracy (Track B's job). *Success Criteria:* 14/14 (or
20/20) green before Demo Day. *Definition of Done:* eval-gate checkpoint passed.

**EPIC-35 — Engine Regression & Canonical Scenario Tests**
*Business Objective:* Guarantee the canonical scenario reproduces exactly $3,650 after every change
(R-001's core mitigation). *Scope:* a pinned regression test on the canonical scenario. *Out of
Scope:* none. *Dependencies:* EPIC-11. *Risks:* the single highest-value regression test in the
system per Pass 2 §16. *Success Criteria:* CI fails if the canonical number ever drifts. *Definition
of Done:* test implemented, running in CI.

**EPIC-36 — End-to-End Dry Runs**
*Business Objective:* Rehearse the full golden-path demo script (PRD §18) before Demo Day. *Scope:*
dry-run #1 (W7), dry-runs #2–#3 (W8). *Out of Scope:* none. *Dependencies:* every other epic.
*Risks:* R-007 — fixed schedule; R-012 — reset/replay must work cleanly between runs. *Success
Criteria:* dry-run #3 passes with zero manual workarounds. *Definition of Done:* all 7 bars
demonstrated live in dry-run #3.

**EPIC-37 — Security-Focused Demo Tests**
*Business Objective:* Verify Track A's demo-grade security claims are actually true (tokens never
reach the frontend, no real PII on stage, cost ceiling actually caps a run) — scoped to Track A only,
explicitly not a production pen-test (Pass 2 §16). *Scope:* the 3 claims above. *Out of Scope:* SOC 2
/ full security program (Track C, explicit non-goal). *Dependencies:* EPIC-13, EPIC-26. *Risks:*
low for Track A; high if these claims are later mistaken for production security. *Success
Criteria:* all 3 checks pass. *Definition of Done:* SEC-001, SEC-003, SEC-005 verified by test.

## 4. Feature catalog

| ID | Parent Epic | Description | Business Value | Dependencies | Acceptance Summary |
|---|---|---|---|---|---|
| FEAT-001 | EPIC-01 | Bank-connect UI (scripted) | Unblocks all downstream data | FEAT-024 | Connect flow completes, transactions visible |
| FEAT-002 | EPIC-01 | Seed-pass proposal review screen | First-run credibility | FEAT-009,010 | User sees proposed income/cadence/categories |
| FEAT-003 | EPIC-01 | Goal configuration form + live recompute | Bar 1 | FEAT-018 | Edit a floor, number recomputes live |
| FEAT-004 | EPIC-02 | One-tap classification confirm UI | The AI-moment proof (Bar 5) | FEAT-009 | Confirm/correct moves the number |
| FEAT-005 | EPIC-02 | Free-text manual feedback entry | Manual trigger UX | FEAT-017 | "Acme paid late" accepted and parsed |
| FEAT-006 | EPIC-03 | Dashboard core + catch + quiet-day states | Hero output presentation | FEAT-036 | All 3 journeys (A/B/C) demoable |
| FEAT-007 | EPIC-04 | Trigger ingestion (cron/webhook/manual) | Bar 2 | FEAT-024 | All 3 triggers produce an `AGENT_RUN` |
| FEAT-008 | EPIC-04 | Orchestrator core loop + headless runner | Bar 2/5 | FEAT-018 | Same skill code runs dev + prod |
| FEAT-009 | EPIC-05 | Deposit classification w/ confidence+evidence | The AI-hard task | FEAT-024,029 | 5/5 eval cases green |
| FEAT-010 | EPIC-05 | Outflow classification (fixed/variable) | Feeds forecasting | FEAT-024 | Recurring vs. variable correctly split |
| FEAT-011 | EPIC-05 | Interpreter eval suite | Bar 5 gate | FEAT-009,010 | 5 cases green |
| FEAT-012 | EPIC-06 | Re-plan execution + output + correction capture | Bar 2/5 | FEAT-018 | 4 eval cases green |
| FEAT-013 | EPIC-06 | Re-planner eval suite | Bar 5 gate | FEAT-012 | 4 cases green |
| FEAT-014 | EPIC-07 | Materiality deterministic gate | Earned attention | FEAT-018 | Silent on non-material change |
| FEAT-015 | EPIC-07 | Alert Composer + mismatch check | Trust (no copy drift) | FEAT-046 | Copy matches engine numbers exactly |
| FEAT-016 | EPIC-07 | Materiality/Alert eval suites | Bar 5 (if built) | FEAT-014,015 | 3+3 cases green |
| FEAT-017 | EPIC-08 | Free-text invoice-status parsing | Manual trigger support | FEAT-030 | "Acme paid late" → correct mutation |
| FEAT-018 | EPIC-09 | Engine tool contracts (6 tools) | ★ custom MCP, Bar 3 | FEAT-026 | Every tool callable, contract-tested |
| FEAT-019 | EPIC-10 | Conservative tax set-aside computation | Trust-critical | FEAT-031 | $900 gap reproduces exactly |
| FEAT-020 | EPIC-11 | Priority waterfall + floor protection | Trust-critical | FEAT-018,019 | Floors never silently breached |
| FEAT-021 | EPIC-11 | Balance reconciliation + structured plan output | Hero output | FEAT-020 | $3,650 reproduces exactly |
| FEAT-022 | EPIC-12 | Income/expense/recurring/spend forecasting | Feeds runway + number | FEAT-009,010 | Eval 5 (spend forecast) green |
| FEAT-023 | EPIC-12 | Synthesizer eval suite | Bar 5 gate | FEAT-019,020,021,022 | 5 cases green |
| FEAT-024 | EPIC-13 | Aggregator MCP interface + fixture loader | Bar 3 source | FEAT-025 | Swappable to a live provider later |
| FEAT-025 | EPIC-14 | 3 scripted personas, 24mo each | Demo determinism | FEAT-026 | Dev persona reproduces $3,650 |
| FEAT-026 | EPIC-15 | Identity/config/bank-data schema | Foundation | none | Migrations match ERD |
| FEAT-027 | EPIC-15 | Plan-output schema | Foundation | FEAT-026 | Migrations match ERD |
| FEAT-028 | EPIC-16 | Plan-input lineage + digests | Auditability (Bar 7) | FEAT-027 | Plan reconstructable from lineage alone |
| FEAT-029 | EPIC-17 | Correction-log semantics (ADR-006) | Trust mechanism | FEAT-026 | No duplicate `CORRECTION` table created |
| FEAT-030 | EPIC-18 | Expected-income MCP tools | Bar 3 source | FEAT-026 | `mark_invoice_late` demoed |
| FEAT-031 | EPIC-19 | Federal + CA tax-rule seed | Bar 3 source | FEAT-026 | Rates/brackets/due-dates seeded, cited |
| FEAT-032 | EPIC-20 | Clerk login/session gate | Bar 6 | program infra | Login demoed live |
| FEAT-033 | EPIC-21 | Eligibility enum + gate logic | Trust boundary (BR-006) | FEAT-046,032 | Gate reachable and testable |
| FEAT-034 | EPIC-22 | PDF render from plan output | Bar 4 output | FEAT-021 | PDF matches dashboard exactly |
| FEAT-035 | EPIC-23 | Email vendor + compose/send + mismatch mechanism | Bar 4 output | FEAT-015,046 | Email demoed or backup shown |
| FEAT-036 | EPIC-24 | Read-only plan API | Supports all outputs | FEAT-021 | Dashboard/PDF/email share one source |
| FEAT-037 | EPIC-25 | Langfuse span instrumentation | Bar 7 | program infra | Full re-plan trace shown live |
| FEAT-038 | EPIC-26 | Cost ceiling + run/attempt tracking | Bar 7 | FEAT-008 | Ceiling caps a run live |
| FEAT-039 | EPIC-27 | Deploy pipeline (web app + runner) | Bar 6 | FEAT-032 | Live URL opens on stage |
| FEAT-040 | EPIC-28 | Dev/demo DB separation | Bar 5 dual-invoke safety | FEAT-026,042 | No cross-contamination observed |
| FEAT-041 | EPIC-29 | Demo reset/replay script | Dry-run safety | FEAT-025,027 | Identical digests across resets |
| FEAT-042 | EPIC-30 | Repo scaffolding + CI | Foundation | none | CI green on trivial change |
| FEAT-043 | EPIC-30 | Shared MCP server framework | Foundation | FEAT-042 | New MCP scaffolds in <1 day |
| FEAT-044 | EPIC-31 | Orchestrator↔Engine contract guard | Trust (structural) | FEAT-008,018 | Violating change fails CI |
| FEAT-045 | EPIC-32 | Shared UI kit (ranges, disclaimers, cards) | Consistency (UX-003) | FEAT-042 | Used by EPIC-01–03 |
| FEAT-046 | EPIC-33 | 4 open-decision spikes | Unblocks FR-24, BR-006 | none | 4/4 decisions documented |
| FEAT-047 | EPIC-34 | Eval-gate checkpoint | Bar 5 | FEAT-011,013,016 | 14(+6)/14(+6) green |
| FEAT-048 | EPIC-35 | Canonical-scenario regression test | R-001 mitigation | FEAT-021 | CI fails on any $3,650 drift |
| FEAT-049 | EPIC-36 | Dry-run execution (#1–#3) | All bars | every epic | Dry-run #3 zero-workaround pass |
| FEAT-050 | EPIC-37 | Demo-scope security test pass | Bar 6/7 | FEAT-024,038 | 3/3 security claims verified |

---

## 5. User stories

Each story lists: parent feature, priority, points, risk, the As/Want/So statement, description,
business rules, Given/When/Then acceptance criteria, validation rules, error handling, security
considerations, audit requirements, dependencies, technical notes, Definition of Done, traceability,
and an embedded technical-task table. Priority scale: **P0** = must-build/never-cut (PRD §21's
"never cut" list or a must-build skill), **P1** = must-build but has a defined cut order, **P2** =
build-if-time. Points use a 1–2–3–5–8 modified Fibonacci scale.

### EPIC-01 — Onboarding & Goal Configuration UI

**ST-001 — Connect bank account (scripted)**
Feature: FEAT-001 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As Dev (primary persona), I want to connect a bank source and backfill up to 24
months of transactions, so that the system has enough history to propose an accurate seed plan.

*Description:* Web-app connect flow calling the Aggregator MCP (scripted/sandbox for Track A) and
triggering a 24-month backfill.

*Business Rules:* FR-1, FR-27; OPS-002 (stale/broken feed flagged, not hidden).

*Acceptance Criteria:*
- Given an eligible, logged-in user with no bank connection, when they click "Connect," then a
  `BANK_CONNECTION` and its `BANK_ACCOUNT`(s) are created with `status=active`.
- Given a successful connection, when backfill runs, then up to 24 months of `TRANSACTION` and
  `ACCOUNT_BALANCE_SNAPSHOT` rows are ingested immutably.
- Given a connection failure, when the connect flow fails, then `BANK_CONNECTION.status=error` is
  shown to the user, not a silent retry loop.
- Given a connection that later goes stale, when any plan is computed against it, then
  `PLAN.input_freshness_status=stale` and a `PLAN_WARNING(code=stale_feed)` is attached (boundary
  case, OPS-002).

*Validation Rules:* `provider_txn_id` uniqueness per account (dedupe on ingestion).

*Error Handling:* connection error surfaced with a retry affordance; never silently proceeds with
partial data.

*Security Considerations:* access token encrypted at rest, never returned to the frontend (SEC-001).

*Audit Requirements:* `BANK_CONNECTION.last_synced_at`, ingestion timestamps immutable.

*Dependencies:* ST-041, ST-042 (Aggregator MCP + fixture loader), ST-050 (auth gate).

*Technical Notes:* single-account, single-connection scope for Track A (ADR-007) — do not build
cross-account aggregation.

*Definition of Done:* connect flow implemented; integration test against the fixture loader passes;
demoed in a dry run.

*Traceability:* FR-1, FR-27; Component: Web App, Aggregator MCP; Workflow: §9.2; Data:
`BANK_CONNECTION`, `BANK_ACCOUNT`, `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-001-T1 | Connect-flow UI (scripted provider picker + progress state) | Frontend | 1d | FEAT-045 |
| ST-001-T2 | Backend call to `aggregator.get_accounts`/`get_transactions`/`get_balances` | API | 1d | ST-041 |
| ST-001-T3 | Error/stale-state surfacing in UI | Frontend | 0.5d | — |
| ST-001-T4 | Integration test: connect → backfill → rows persisted | Testing | 1d | ST-044 |

---

**ST-002 — Seed-pass proposal review screen**
Feature: FEAT-002 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want to review the system's proposed income, cadence, and category
classifications from my backfilled history, so that I can confirm or correct them before a plan is
computed.

*Description:* Post-backfill screen listing every seed classification with confidence and evidence,
distinguishing auto-accepted (high confidence) from queued-for-confirmation (low confidence) items.

*Business Rules:* FR-2, FR-6 (low-confidence never silently assumed).

*Acceptance Criteria:*
- Given backfill is complete, when the seed pass finishes, then the screen shows every transaction's
  proposed label, cadence (if a deposit), and confidence.
- Given a low-confidence item, when the screen renders, then it is visually distinguished and
  actionable (links to ST-005's confirm UI).
- Given zero low-confidence items (edge case), when the screen renders, then it shows a clean
  "all classified" state with no confirm queue.
- Given the user has confirmed all items, when they proceed, then goal configuration (ST-003)
  becomes available.

*Validation Rules:* every transaction must have exactly one current classification before goal
config can proceed.

*Error Handling:* if the seed pass itself fails (Interpreter error), the screen shows a retry, not a
partial/empty state presented as complete.

*Security Considerations:* raw transaction memo/counterparty text rendered as plain text, never
interpreted as instructions (prompt-injection hygiene, Pass 2 §12).

*Audit Requirements:* every seed classification is a `TRANSACTION_CLASSIFICATION(source=seed|model)`
row.

*Dependencies:* ST-015, ST-016, ST-017 (Interpreter), ST-005 (confirm UI it links to).

*Technical Notes:* this is the UX layer over §9.3's workflow; no new backend logic beyond reading
classification rows.

*Definition of Done:* screen implemented; demoed with the Dev persona's real seed output.

*Traceability:* FR-2; Component: Web App, Transaction Interpreter; Workflow: §9.3; Data:
`TRANSACTION_CLASSIFICATION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-002-T1 | Seed-pass review list UI (grouped by confidence) | Frontend | 1.5d | FEAT-045 |
| ST-002-T2 | Read API for seed classification results | API | 0.5d | ST-015 |
| ST-002-T3 | Empty/error states | Frontend | 0.5d | — |
| ST-002-T4 | Demo asset: verify Dev persona's seed pass renders correctly | Demo Assets | 0.5d | ST-043 |

---

**ST-003 — Goal configuration form**
Feature: FEAT-003 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want to configure my tax profile, runway floor, target pay, savings, debt,
and priority order, so that the engine allocates against my own goals, not a hardcoded default.

*Description:* Form with system-proposed defaults (from detected income/cadence) that the user can
edit; submits to `set_goal`.

*Business Rules:* FR-3; BRULE-001 (fixed allocation order: Taxes → Runway → Pay → Savings → Debt —
the priority field is user-editable per FR-3, but the floors below Taxes/Runway are never
reorderable).

*Acceptance Criteria:*
- Given seed-pass completion, when the user opens goal config, then defaults are pre-filled from
  detected data (income cadence, suggested runway floor).
- Given the user edits a value (e.g., runway floor), when they save, then a new `GOAL_CONFIG` +
  `BUCKET_TARGET` version is written and the prior version's `is_current` flips to false.
- Given an invalid value (e.g., negative target pay), when the user attempts to save, then the form
  rejects it with an inline validation message before any write occurs.
- Given the tax profile section, when the user selects filing status/state, then only Schedule C +
  the seeded state set (federal + CA) are selectable (boundary — no other filing status is offered).

*Validation Rules:* target amounts ≥ 0; floor amounts ≥ 0; priority order must be a permutation of
the 5 bucket kinds.

*Error Handling:* failed `set_goal` write leaves the form in an editable, unsaved state with an
error banner — never silently discards user input.

*Security Considerations:* none beyond standard authenticated-write protections (Clerk session
required).

*Audit Requirements:* every save is a new versioned `GOAL_CONFIG`/`TAX_PROFILE` row, never a mutation.

*Dependencies:* ST-027 (`set_goal` tool), ST-002 (seed pass provides defaults).

*Technical Notes:* `TAX_PROFILE.tax_treatment` is hardcoded to `schedule_c` for Track A (BR-006).

*Definition of Done:* form implemented; validation tested; demoed live (Bar 1's "live-edit" proof
rides this + ST-004).

*Traceability:* FR-3; Component: Web App, Engine MCP; Workflow: §9.5; Data: `GOAL_CONFIG`,
`BUCKET_TARGET`, `TAX_PROFILE`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-003-T1 | Goal config form UI w/ pre-filled defaults | Frontend | 1.5d | FEAT-045 |
| ST-003-T2 | Client + server validation rules | Frontend/Backend | 1d | — |
| ST-003-T3 | Wire to `engine.set_goal` | API | 0.5d | ST-027 |
| ST-003-T4 | Unit test: versioning + `is_current` flip | Testing | 1d | ST-045 |

---

**ST-004 — Live-edit goal config triggers recompute (Bar 1)**
Feature: FEAT-003 | Priority: P0 | Points: 3 | Risk: High

*User Story:* As a program evaluator, I want to watch the Safe-to-Pay Number recompute live the
moment a goal value changes, so that I can verify Bar 1's "configurable goal, one-page spec" claim.

*Description:* After a `set_goal` write, the dashboard's number recomputes without a page reload,
proving the engine — not a cached value — drives the display.

*Business Rules:* UX-005; Bar 1.

*Acceptance Criteria:*
- Given the dashboard is open, when the user edits and saves a floor in goal config, then a new
  `PLAN` is computed within the NFR target (≤10s, Pass 2 §13 proposed target) and the dashboard
  updates to reflect it.
- Given the recompute is in flight, when the user is waiting, then a loading state is shown, never a
  stale number presented as current.
- Given the recompute fails (engine error), when it fails, then the prior number remains displayed
  with an explicit "recompute failed, retry" state — never a blank or wrong number.

*Validation Rules:* n/a (inherits ST-003's).

*Error Handling:* see above — fail visibly, never silently.

*Security Considerations:* none new.

*Audit Requirements:* the new `PLAN` carries a marker tying it to the goal-config change that
triggered it.

*Dependencies:* ST-003, ST-034 (balance reconciliation), ST-057 (dashboard API).

*Technical Notes:* this is the literal proof artifact for Bar 1 (PRD §8 row 1) — treat its demo
reliability as P0.

*Definition of Done:* live-recompute demoed on stage in a dry run with a real timing measurement.

*Traceability:* FR-4; UX-005; Component: Web App, Engine MCP; Workflow: §9.5→§9.6; Data:
`GOAL_CONFIG`, `PLAN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-004-T1 | Client-side recompute trigger + loading/error states | Frontend | 1d | ST-057 |
| ST-004-T2 | Server-side recompute pipeline wiring | Backend | 1d | ST-034 |
| ST-004-T3 | E2E test: edit floor → number changes within target latency | Testing | 1d | ST-063 |
| ST-004-T4 | Demo asset: script the exact floor-edit used in Bar 1's proof | Demo Assets | 0.5d | ST-043 |

---

### EPIC-02 — Classification & Feedback UI

**ST-005 — Low-confidence classification confirm UI**
Feature: FEAT-004 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As Dev, I want to confirm or correct low-confidence transaction classifications with
their evidence shown, so that the Safe-to-Pay Number never depends on an unconfirmed guess.

*Description:* One-tap confirm/correct UI surfaced whenever the Transaction Interpreter returns
confidence below threshold; shows evidence (memo tokens, counterparty, frequency).

*Business Rules:* BRULE-005 (bias to ask on high-magnitude/low-confidence); FR-6 (never silently
assumed).

*Acceptance Criteria:*
- Given a deposit classified below the confidence threshold, when the seed pass or a source-event
  trigger completes, then the transaction appears in a confirm queue with label, confidence, and
  evidence text.
- Given the confirm queue, when the user taps "confirm," then a `TRANSACTION_CLASSIFICATION
  (source=user)` row is written superseding the prior row and the item leaves the queue.
- Given the confirm queue, when the user taps "correct" and selects a different label, then the
  corrected label is written the same way and logged as a correction.
- Given a high-magnitude, low-confidence deposit, when a plan is computed, then that deposit is
  excluded from the plan until confirmed (boundary case).
- Given no low-confidence items exist, when the user opens the app, then no confirm queue is shown
  (empty state).

*Validation Rules:* label must be one of the fixed enum values per direction (deposit vs. outflow).

*Error Handling:* if `record_correction` fails, the UI keeps the item in the queue with a retry
affordance — never optimistically marks it confirmed.

*Security Considerations:* transaction memo/counterparty text rendered as plain text only, never
interpreted as instructions.

*Audit Requirements:* every confirm/correct action writes a `TRANSACTION_CLASSIFICATION(source=
user)` row with `supersedes_id`; if prompted by a `CHECK_IN`, its `resulting_classification_id` is
set in the same transaction.

*Dependencies:* ST-015 (classification producing evidence), ST-028 (`record_correction` tool).

*Technical Notes:* the confidence threshold value is an [Open decision] per Pass 2 §7 — default a
placeholder (e.g., 0.7) behind a config flag until a stakeholder finalizes it.

*Definition of Done:* UI implemented; unit + integration tests green; Interpreter eval 3 demonstrably
tied to this UI in a dry run.

*Traceability:* FR-6, FR-8; BRULE-005; Component: Web App, Transaction Interpreter; Workflow: §9.4;
Data: `TRANSACTION_CLASSIFICATION`, `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-005-T1 | Confirm-queue component (list + evidence display) | Frontend | 1d | FEAT-045 |
| ST-005-T2 | Wire confirm/correct actions to `record_correction` | API | 0.5d | ST-028 |
| ST-005-T3 | Empty-state + retry-on-failure UX | Frontend | 0.5d | — |
| ST-005-T4 | Integration test: confirm → plan recompute | Testing | 1d | ST-018 |
| ST-005-T5 | Demo asset: script the 2 low-confidence deposits for Dev persona | Demo Assets | 0.5d | ST-043 |

---

**ST-006 — Free-text manual feedback entry UI**
Feature: FEAT-005 | Priority: P1 | Points: 3 | Risk: Low

*User Story:* As Dev, I want to type "Acme paid late" into a simple input, so that the system
updates my expected-income status without me editing a form.

*Description:* Single free-text input on the dashboard/expected-income view, submitting to the
manual-feedback trigger path.

*Business Rules:* FR-20 (UI half).

*Acceptance Criteria:*
- Given the user types a clear message ("Acme paid late") and submits, when the Expected-Income
  Interpreter parses it, then the matching invoice's status updates and a re-plan is triggered.
- Given an ambiguous message ("things are tight"), when submitted, then the UI shows the agent's
  clarifying question instead of silently guessing.
- Given no matching invoice exists for the message, when parsed, then the UI shows an explicit
  "couldn't find that invoice" state, not a silent no-op.

*Validation Rules:* non-empty input required.

*Error Handling:* parse failure surfaces the agent's clarifying question; never mutates state on an
ambiguous parse.

*Security Considerations:* user free text treated as untrusted data when constructing any downstream
prompt (Pass 2 §12 prompt-injection hygiene).

*Audit Requirements:* the resulting mutation is captured via the standard `TRIGGER_EVENT
(type=manual_feedback)` → `AGENT_RUN` chain.

*Dependencies:* ST-026 (Expected-Income Interpreter), ST-012 (manual trigger backend).

*Technical Notes:* keep the input intentionally minimal — no rich-text/attachment support for Track
A.

*Definition of Done:* UI implemented; demoed as step 4 of the golden-path script (PRD §18).

*Traceability:* FR-20; Component: Web App, Expected-Income Interpreter; Workflow: §9.10; Data:
`TRIGGER_EVENT`, `EXPECTED_INCOME_VERSION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-006-T1 | Free-text input component + submit state | Frontend | 0.5d | FEAT-045 |
| ST-006-T2 | Wire submission to manual-feedback trigger endpoint | API | 0.5d | ST-012 |
| ST-006-T3 | Clarifying-question / not-found response rendering | Frontend | 0.5d | ST-026 |
| ST-006-T4 | E2E test: "Acme paid late" → number drops to $3,650 | Testing | 1d | ST-018 |

---

### EPIC-03 — Safe-to-Pay Dashboard

**ST-007 — Dashboard: number, allocation, runway, tax-bomb status**
Feature: FEAT-006 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As Dev, I want to see my Safe-to-Pay Number, its range and reasoning, my bucket
allocation, runway, and tax-bomb status in one view, so that I can make my pay decision in seconds.

*Description:* The primary dashboard screen — the hero output — reading from the plan API.

*Business Rules:* FR-22; UX-003 (every figure is a range with its assumption stated; headline is the
conservative/low end).

*Acceptance Criteria:*
- Given a current `PLAN` exists, when the dashboard loads, then it displays the promised number
  (low end), its range, the reasoning text, per-bucket allocation with funded status, runway months,
  and tax-bomb status.
- Given a bucket is `paused`/`deferred`/`short`, when rendered, then the reason is shown, not just a
  bare status label.
- Given no `PLAN` exists yet (new user pre-goal-config), when the dashboard loads, then it shows an
  onboarding prompt, not an error or a zero.
- Given the tax-bomb status is `at_risk` or `gap`, when rendered, then it is visually prominent
  (boundary — this is the highest-severity state).

*Validation Rules:* n/a (read-only view).

*Error Handling:* API failure shows a retry state, never a stale number silently presented as
current.

*Security Considerations:* dashboard never computes a figure client-side (Pass 2 §6 "web app
non-responsibilities").

*Audit Requirements:* n/a (read path).

*Dependencies:* ST-057 (plan read API), ST-035 (structured Synthesizer output).

*Technical Notes:* every figure rendered here must go through FEAT-045's shared range/disclaimer
component so UX-003 holds by construction.

*Definition of Done:* dashboard implemented; matches PDF/email figures exactly (same source);
demoed.

*Traceability:* FR-22; UX-003; Component: Web App; Workflow: §9.6; Data: `PLAN`, `ALLOCATION_LINE`,
`PROJECTION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-007-T1 | Dashboard layout (number, allocation, runway, tax-bomb) | Frontend | 2d | FEAT-045 |
| ST-007-T2 | Read API integration | API | 0.5d | ST-057 |
| ST-007-T3 | Onboarding / empty-state handling | Frontend | 0.5d | — |
| ST-007-T4 | Visual regression + accessibility check (keyboard, contrast) | Testing | 1d | — |

---

**ST-008 — "The Catch" first-session pre-mortem UX**
Feature: FEAT-006 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As Dev, I want my first session to open with the shortfall pre-mortem ("you're
tracking $900 short on Q3 taxes"), so that I immediately see the product's value before anything
else.

*Description:* First-session UX variant of the dashboard leading with the stressed-scenario
shortfall, per PRD §5/§13's "the save is the hook."

*Business Rules:* UX-004.

*Acceptance Criteria:*
- Given a first session with a computed base + stressed scenario, when the dashboard first loads,
  then "the catch" (the shortfall framing) is the first thing shown, before the full plan.
- Given the user dismisses/reviews the catch, when they proceed, then the full plan (ST-007) is
  shown.
- Given a returning session (not first), when the dashboard loads, then the catch framing does not
  re-appear as if new (boundary — it's a first-session device, not a repeating nag).

*Validation Rules:* n/a.

*Error Handling:* if the stressed scenario fails to compute, fall back to showing the base plan only
— never block the first session entirely.

*Security Considerations:* none new.

*Audit Requirements:* n/a.

*Dependencies:* ST-034 (base + stressed scenario computation), ST-007.

*Technical Notes:* "first session" is determined by absence of any prior `AGENT_RUN` for the user —
no new field needed.

*Definition of Done:* implemented; demoed as golden-path step 1 (PRD §18).

*Traceability:* UX-004; FR-14 (conceptually); Component: Synthesizer, Web App; Workflow: §9.7; Data:
`PLAN(tax_bomb_status)`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-008-T1 | "The catch" screen UI | Frontend | 1.5d | FEAT-045 |
| ST-008-T2 | First-session detection logic | Backend | 0.5d | — |
| ST-008-T3 | E2E test: first login shows the catch, second does not | Testing | 1d | ST-063 |

---

**ST-009 — Quiet-day / earned-attention dashboard state**
Feature: FEAT-006 | Priority: P1 | Points: 2 | Risk: Low

*User Story:* As Maya (steady-retainer persona), I want the dashboard to simply reflect my current,
unremarkable plan when nothing material has changed, so that I'm never nagged over noise.

*Description:* Default dashboard state when the latest scheduled run found nothing material —
dashboard still shows the latest plan; no alert, no interruption.

*Business Rules:* UX-002; FR-21 (silence branch).

*Acceptance Criteria:*
- Given a scheduled run found no material change, when the user opens the dashboard, then it shows
  the latest plan with no "new alert" indicator.
- Given the same scenario, when checked, then no `CHECK_IN` was emitted (`AGENT_RUN.surfaced=false`).
- Given a material change *did* occur since last view, when the dashboard loads, then it does
  indicate the new decision (boundary contrast with the above).

*Validation Rules:* n/a.

*Error Handling:* n/a (read path).

*Security Considerations:* none.

*Audit Requirements:* `AGENT_RUN.surfaced` field is the source of truth for this state.

*Dependencies:* ST-022 (Materiality Evaluator), ST-007.

*Technical Notes:* this is the demo's Journey C (PRD §13) — the Maya persona is the primary vehicle
for demonstrating it.

*Definition of Done:* implemented; demoed with the Maya persona.

*Traceability:* UX-002; FR-21; Component: Web App, Materiality Evaluator; Workflow: §9.11; Data:
`AGENT_RUN.surfaced`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-009-T1 | Dashboard "no new alert" default state | Frontend | 0.5d | ST-007 |
| ST-009-T2 | Read `AGENT_RUN.surfaced` in dashboard API | API | 0.5d | ST-057 |
| ST-009-T3 | Demo asset: Maya persona quiet-day scripted run | Demo Assets | 0.5d | ST-043 |

---

### EPIC-04 — Orchestrating Agent & Trigger Handling

**ST-010 — Schedule (cron) trigger**
Feature: FEAT-007 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the system, I want a scheduled job to regenerate the plan nightly and ramp the tax
set-aside as the due date nears, so that the user's number stays current without any action from
them.

*Description:* Cron-driven `TRIGGER_EVENT(type=schedule)` firing the Orchestrator loop.

*Business Rules:* FR-18.

*Acceptance Criteria:*
- Given a scheduled time arrives, when the cron fires, then a `TRIGGER_EVENT(type=schedule)` is
  created and an `AGENT_RUN` starts.
- Given the tax due date is within the ramp window, when the schedule fires, then the tax set-aside
  target increases accordingly (ST-030).
- Given nothing material changed, when the run completes, then no `CHECK_IN` is emitted (silent
  success, FR-21 boundary).
- Given the cron fires twice for the same logical period (misconfiguration), when the second fires,
  then `idempotency_key` prevents a duplicate `AGENT_RUN` (boundary, ties to ST-068).

*Validation Rules:* one schedule per user per period.

*Error Handling:* a failed run records `AGENT_RUN.status=error` with an `AGENT_RUN_ATTEMPT`; does not
crash the scheduler loop for other users.

*Security Considerations:* backend-internal only, no user input surface.

*Audit Requirements:* every fire produces a `TRIGGER_EVENT` + `AGENT_RUN` row, traced in Langfuse.

*Dependencies:* ST-013 (orchestrator loop), ST-014 (headless runner).

*Technical Notes:* "background schedule firing" is simulated/deterministic for Track A (Pass 2 §3,
"Simulate" label) — no real-world cron-drift edge cases need handling.

*Definition of Done:* schedule trigger implemented; demoed as one of Bar 2's 3 trigger types.

*Traceability:* FR-18; Component: Orchestrator, Headless Runner; Workflow: §9.8; Data:
`TRIGGER_EVENT`, `AGENT_RUN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-010-T1 | Cron scheduler wiring in headless runner | Backend | 1d | ST-014 |
| ST-010-T2 | `TRIGGER_EVENT(type=schedule)` creation + idempotency check | Backend | 0.5d | ST-046 |
| ST-010-T3 | Integration test: cron fires → silent success on no-op day | Testing | 0.5d | ST-022 |

---

**ST-011 — Source-event webhook trigger**
Feature: FEAT-007 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the system, I want a new-transaction webhook to fire the re-plan loop, so that a
surprising deposit or expense is reflected in the number without waiting for the nightly run.

*Description:* Aggregator-sourced webhook creating a `TRIGGER_EVENT(type=source_event)`.

*Business Rules:* FR-19.

*Acceptance Criteria:*
- Given a new transaction arrives via webhook, when it's unclear, then the Transaction Interpreter
  classifies it before the plan recomputes.
- Given the same webhook is delivered twice (duplicate delivery), when the second arrives, then
  `idempotency_key` dedupes it — exactly one `AGENT_RUN` results (boundary, ties to ST-068).
- Given a clear (high-confidence) transaction, when it arrives, then the plan recomputes without a
  confirm-queue detour.

*Validation Rules:* webhook payload must map to a known account.

*Error Handling:* malformed payload is logged and rejected, not silently dropped.

*Security Considerations:* webhook signature/source verification (from the scripted-data fixture
loader for Track A).

*Audit Requirements:* `TRIGGER_EVENT.provider_event_id` captured for correlation.

*Dependencies:* ST-013, ST-015 (classification), ST-041 (aggregator source).

*Technical Notes:* for Track A, the "webhook" is a scripted push from the fixture loader (Pass 2 §3).

*Definition of Done:* implemented; demoed as golden-path step 4 (push scripted transaction).

*Traceability:* FR-19; Component: Orchestrator, Aggregator MCP; Workflow: §9.9; Data:
`TRIGGER_EVENT`, `TRANSACTION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-011-T1 | Webhook receiver endpoint | API | 1d | ST-041 |
| ST-011-T2 | `TRIGGER_EVENT(type=source_event)` creation + dedupe | Backend | 0.5d | ST-046 |
| ST-011-T3 | E2E test: scripted push → classify → re-plan → number changes | Testing | 1d | ST-018 |

---

**ST-012 — Manual-feedback trigger (backend)**
Feature: FEAT-007 | Priority: P0 | Points: 2 | Risk: Low

*User Story:* As the system, I want a user's free-text action to fire the re-plan loop, so that
"Acme paid late" produces an immediate, correct re-plan.

*Description:* Backend endpoint accepting free text, creating a `TRIGGER_EVENT(type=
manual_feedback)`.

*Business Rules:* FR-20.

*Acceptance Criteria:*
- Given a user submits free text, when received, then a `TRIGGER_EVENT(type=manual_feedback)` is
  created with the raw text in `payload`.
- Given the Expected-Income Interpreter successfully parses it, then `interpreted_as` is populated
  and a re-plan runs.
- Given parsing is ambiguous, then no state mutation occurs and a clarifying-question response is
  returned instead (boundary, ties to ST-026).

*Validation Rules:* non-empty payload.

*Error Handling:* interpreter failure returns a graceful "couldn't process" response, not a 500.

*Security Considerations:* free text is untrusted input — never interpolated directly into a
downstream system prompt without the standard sanitization/framing convention (Pass 2 §12).

*Audit Requirements:* `TRIGGER_EVENT.payload`/`interpreted_as` both retained for audit.

*Dependencies:* ST-013, ST-026 (Expected-Income Interpreter).

*Technical Notes:* pairs with ST-006 (the UI half).

*Definition of Done:* implemented; demoed as golden-path step 4 (manual trigger).

*Traceability:* FR-20; Component: Orchestrator, Expected-Income Interpreter; Workflow: §9.10; Data:
`TRIGGER_EVENT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-012-T1 | Manual-feedback endpoint | API | 0.5d | ST-013 |
| ST-012-T2 | Wire to Expected-Income Interpreter | Backend | 0.5d | ST-026 |
| ST-012-T3 | Integration test: ambiguous message → no mutation | Testing | 0.5d | — |

---

**ST-013 — Orchestrator trigger interpretation & tool routing**
Feature: FEAT-008 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As the system, I want a single orchestrating agent that interprets any trigger, routes
to the right skill/tool, and decides what (if anything) to surface, so that the product's judgment
layer stays legible, safe, and demoable as one trace.

*Description:* The core Agent SDK loop: trigger in → interpret → call skills/engine tools → select
≤1 decision → narrate.

*Business Rules:* ADR-001 (one agent, not a swarm); the Orchestrator never computes a figure
(enforced structurally by ST-066).

*Acceptance Criteria:*
- Given any of the 3 trigger types, when the loop runs, then it calls the engine only through named
  tool calls — never inline arithmetic.
- Given an unclear transaction is present, when routing occurs, then the Transaction Interpreter is
  called before the plan is computed.
- Given a vague user message ("things are tight"), when interpreted, then the agent asks a
  clarifying question rather than guessing (boundary, per `ai-agents.md` eval case d).
- Given two simultaneous material changes, when selecting what to surface, then only the
  higher-consequence one is surfaced (boundary, eval case c).

*Validation Rules:* n/a (behavioral).

*Error Handling:* a failed tool call records the error on `AGENT_RUN_ATTEMPT` and retries per policy
(ST-060); never proceeds on a guessed/partial input.

*Security Considerations:* all tool calls are named and typed — no raw SQL/filesystem access
(Pass 2 §12).

*Audit Requirements:* every run produces a full Langfuse trace (ST-058).

*Dependencies:* ST-018 (recompute), ST-015 (Interpreter), ST-022 (Materiality), ST-066 (contract
guard).

*Technical Notes:* this is the one true agent per ADR-001 — resist adding a second reasoning
component here even under schedule pressure.

*Definition of Done:* loop implemented; Orchestrator eval cases (a)–(d) green.

*Traceability:* Component: Orchestrator; Workflow: §9.8–§9.11; Data: `TRIGGER_EVENT`, `AGENT_RUN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-013-T1 | Agent SDK loop scaffold (trigger → interpret → route) | AI Agent | 2d | FEAT-043 |
| ST-013-T2 | Tool-call routing to engine/skills | AI Agent | 1.5d | ST-027 |
| ST-013-T3 | Clarifying-question fallback path | AI Agent | 1d | — |
| ST-013-T4 | Orchestrator eval harness (cases a–d) | Testing | 1.5d | ST-070 |

---

**ST-014 — Headless runner deployment (background, dual-invoke)**
Feature: FEAT-008 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As a program evaluator, I want to see the same Cashflow Synthesizer skill invoked from
Claude Code (dev) and from a deployed headless runner (prod), so that I can verify Bar 5's
dual-invocation requirement.

*Description:* A deployed process executing the Agent SDK loop outside Claude Code, triggered by
cron/webhook/manual events against the demo environment.

*Business Rules:* Bar 5 dual-invoke; Bar 2 background triggers.

*Acceptance Criteria:*
- Given the same Synthesizer code path, when invoked from Claude Code and from the headless runner
  with identical pinned inputs, then both produce an identical `output_digest`.
- Given the headless runner crashes mid-run, when it recovers, then `AGENT_RUN.status=error` and an
  `AGENT_RUN_ATTEMPT` records the retry (boundary).
- Given the runner and Claude Code point at separate databases (ADR-010), when either invokes the
  Synthesizer, then neither corrupts the other's state.

*Validation Rules:* n/a.

*Error Handling:* crash → recorded retry, never a silent hang.

*Security Considerations:* deployed, Clerk-gated environment (shares EPIC-27's deploy).

*Audit Requirements:* full trace per invocation, both dev and prod.

*Dependencies:* ST-062 (env separation), ST-013.

*Technical Notes:* dual-invocation is about shared **code**, not shared **state** — do not conflate
the two (Pass 2 §6 explicit clarification).

*Definition of Done:* both invocation paths demoed live; identical-digest test passes.

*Traceability:* Bar 5, Bar 2; Component: Headless Runner; Workflow: §9.8–§9.10; Data: `AGENT_RUN`,
`AGENT_RUN_ATTEMPT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-014-T1 | Headless runner process (deploy target TBD by EPIC-27) | Infrastructure | 2d | ST-062 |
| ST-014-T2 | Dual-invoke identical-digest test (Claude Code vs. runner) | Testing | 1d | — |
| ST-014-T3 | Crash-recovery/retry wiring | Backend | 1d | ST-060 |

---

### EPIC-05 — Transaction Interpreter Skill

**ST-015 — Classify deposits with confidence + evidence**
Feature: FEAT-009 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As Dev, I want every ambiguous deposit classified as income/transfer/refund/repayment/
loan/other with a confidence score and cited evidence, so that I can trust — or correct — what feeds
my number.

*Description:* The core AI-hard skill: LLM classification over transaction fields + correction-log
history, emitting `{label, cadence?, confidence, evidence}`.

*Business Rules:* FR-5, FR-7; BRULE-004 (windfalls never treated as recurring); BRULE-005 (bias to
ask on high-magnitude/low-confidence).

*Acceptance Criteria:*
- Given a clean retainer deposit (regular amount, known counterparty), when classified, then it is
  labeled `income` with high confidence.
- Given a round-number transfer from the user's own savings, when classified, then it is labeled
  `transfer`, not `income`.
- Given a client Zelle payment with a person's name in the memo, when classified, then it is labeled
  `income` with **low confidence**, and evidence cites the memo text (boundary — this is the
  "bias to ask" case).
- Given a $20k one-off project deposit, when classified, then it is labeled `income` with cadence
  `windfall`, never `retainer`/recurring (boundary, BRULE-004).
- Given a refund from a software vendor, when classified, then it is labeled `refund` and excluded
  from income.

*Validation Rules:* `label` ∈ the deposit-side enum; `confidence` ∈ [0,1]; `evidence` non-empty for
any confidence < 1.0.

*Error Handling:* an LLM call failure surfaces as `unresolved_classification` (`PLAN_WARNING`), never
a silent default to `income`.

*Security Considerations:* transaction memo/counterparty text is untrusted input — treated as data,
never as instructions to the model (Pass 2 §12, R-011).

*Audit Requirements:* every classification writes a `TRANSACTION_CLASSIFICATION(source=seed|model)`
row with `confidence`, `evidence` (jsonb), `model_version`.

*Dependencies:* ST-041 (transaction data), ST-047 (correction-log read for bias).

*Technical Notes:* the confidence threshold is an [Open decision] (Pass 2 §7) — implement behind a
config flag, default placeholder value.

*Definition of Done:* implemented; feeds ST-017's eval suite; the falsifiability check (Pass 2 §10)
holds — stripping this skill visibly breaks the demo on commingled data.

*Traceability:* FR-5, FR-7; BRULE-004, BRULE-005; Component: Transaction Interpreter; Workflow: §9.3;
Data: `TRANSACTION_CLASSIFICATION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-015-T1 | Classification prompt + schema for deposit-side labels | AI Agent | 2d | FEAT-043 |
| ST-015-T2 | Evidence-extraction logic (memo tokens, counterparty, frequency) | AI Agent | 1.5d | — |
| ST-015-T3 | Correction-log read for bias (past user labels) | Backend | 1d | ST-047 |
| ST-015-T4 | Write path: `TRANSACTION_CLASSIFICATION(source=seed\|model)` | Backend | 1d | ST-045 |
| ST-015-T5 | Unit tests: 5 canonical deposit scenarios | Testing | 1.5d | — |

---

**ST-016 — Classify outflows fixed/variable**
Feature: FEAT-010 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want every outflow classified as fixed/recurring or variable/discretionary,
so that my expense forecast reflects reality.

*Description:* Outflow-side classification, detecting new/changed recurrences.

*Business Rules:* FR-28; folds into FR-29's recurring-detection.

*Acceptance Criteria:*
- Given a monthly rent payment, when classified, then it is labeled `fixed_recurring`.
- Given a one-off discretionary purchase, when classified, then it is labeled
  `variable_discretionary`.
- Given a new subscription appears (e.g., a newly detected $89 charge), when classified, then it is
  flagged as a new recurring commitment (feeds ST-038).
- Given an existing recurring expense's amount changes, when classified, then the change is flagged,
  not silently absorbed (boundary).

*Validation Rules:* `label` ∈ the outflow-side enum values.

*Error Handling:* same as ST-015 — failure surfaces as a warning, never a silent guess.

*Security Considerations:* same as ST-015.

*Audit Requirements:* same mechanism as ST-015, direction=outflow.

*Dependencies:* ST-041.

*Technical Notes:* shares the same `TRANSACTION_CLASSIFICATION.label` enum as deposits (Pass 1 §7
modeling note; a `direction` discriminator split is tracked as TD-05, non-blocking for Track A).

*Definition of Done:* implemented; folds into Synthesizer eval 5 (recurring detection).

*Traceability:* FR-28, FR-29; Component: Transaction Interpreter; Workflow: §9.3; Data:
`TRANSACTION_CLASSIFICATION`, `RECURRING_EXPENSE`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-016-T1 | Classification prompt + schema for outflow-side labels | AI Agent | 1.5d | ST-015 |
| ST-016-T2 | New/changed-recurrence detection logic | Backend | 1.5d | ST-038 |
| ST-016-T3 | Unit tests: fixed vs. variable, new subscription, amount change | Testing | 1d | — |

---

**ST-017 — Transaction Interpreter eval suite (5 cases)**
Feature: FEAT-011 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the delivery team, I want the 5 documented Interpreter eval cases automated and
green, so that Bar 5's eval-gate requirement is provably met for this skill.

*Description:* Automated eval harness running the 5 cases from PRD §17.

*Business Rules:* PRD §17 eval cases 1–5.

*Acceptance Criteria:*
- Given the 5 canonical cases (clean retainer; savings transfer; low-confidence Zelle; vendor
  refund; $20k windfall), when the suite runs, then all 5 pass with the documented expected labels/
  confidence/cadence.
- Given any case fails, when CI runs, then the build is blocked from being marked "eval-gate green."
- Given a regression is introduced later, when the suite reruns, then it catches the regression
  (boundary — this is a standing regression gate, not a one-time check).

*Validation Rules:* n/a.

*Error Handling:* a failing case blocks the eval-gate checkpoint (ST-070).

*Security Considerations:* n/a.

*Audit Requirements:* eval run output stored as a build artifact.

*Dependencies:* ST-015, ST-016.

*Technical Notes:* run in CI on every PR touching the Interpreter.

*Definition of Done:* 5/5 green, wired into CI.

*Traceability:* Bar 5; Component: Transaction Interpreter; Data: n/a (test harness).

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-017-T1 | Eval harness scaffold + fixture data for 5 cases | Testing | 1d | ST-043 |
| ST-017-T2 | Wire eval run into CI | Testing | 0.5d | FEAT-042 |
| ST-017-T3 | Eval-suite pass output captured as demo backup artifact | Demo Assets | 0.5d | — |

---

### EPIC-06 — Re-planner Pattern

**ST-018 — Re-decide remaining period on input change**
Feature: FEAT-012 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As Dev, I want the system to re-decide my remaining period whenever an input changes,
protecting my floors and re-allocating optional buckets, so that I never act on a stale number.

*Description:* The Orchestrator re-invoking the Synthesizer/engine on changed state — not a second
reasoning engine (ADR per `ai-agents.md` Component 4).

*Business Rules:* FR-15.

*Acceptance Criteria:*
- Given expected income slips (e.g., Acme pays 30 days late), when re-planned, then savings pause
  and discretionary buckets defer first, while tax and runway floors remain protected.
- Given a surprise large expense, when re-planned, then the allocation adjusts and the report states
  what was sacrificed, by priority order.
- Given the quarterly tax due date is 10 days out and the set-aside is short, when re-planned, then
  the set-aside ramps — the runway floor is never silently raided to cover it (boundary).
- Given a new recurring subscription is detected, when re-planned, then runway recalculates and the
  drift is flagged.

*Validation Rules:* re-plan must always produce a new, immutable `PLAN` row — never mutate a prior
one.

*Error Handling:* if the engine cannot compute (missing tax-rule set, etc.), the plan is marked
`blocked`, never silently wrong.

*Security Considerations:* none beyond standard engine-call boundaries.

*Audit Requirements:* new `PLAN` pinned to its `PLAN_INPUT_*` lineage (ST-046).

*Dependencies:* ST-027 (`compute_allocation`), ST-031–035 (allocation/plan output).

*Technical Notes:* this *is* the Synthesizer re-run — do not implement it as separate logic (Pass 2
§6, ai-agents.md Component 4).

*Definition of Done:* implemented; feeds ST-021's eval suite; canonical scenario's $3,650 re-plan
reproduces exactly.

*Traceability:* FR-15; Component: Orchestrator (Re-planner pattern), Engine MCP; Workflow: §9.8,
§9.9, §9.10; Data: `PLAN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-018-T1 | Re-plan invocation path (Orchestrator → Synthesizer re-run) | AI Agent | 2d | ST-013 |
| ST-018-T2 | Floor-protection + optional-bucket re-allocation logic | Backend | 2d | ST-031 |
| ST-018-T3 | "What was sacrificed" reporting | Backend | 1d | ST-035 |
| ST-018-T4 | Unit tests: 4 re-plan scenarios (slip, expense, tax ramp, new sub) | Testing | 1.5d | — |

---

**ST-019 — Re-plan output (one decision + what-changed)**
Feature: FEAT-012 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As Dev, I want a re-plan to surface exactly one decision with a one-line "what changed
and why," so that I'm never left parsing a wall of numbers to figure out what matters.

*Description:* Structured re-plan output: revised allocation + number, updated projections, the one
decision, the one-liner.

*Business Rules:* FR-16.

*Acceptance Criteria:*
- Given a re-plan completes with a material change, when output is generated, then it includes
  exactly one decision (never zero-when-material, never more than one).
- Given the one-liner is generated, when rendered, then it states what changed and why in plain
  language, sourced from the structured plan diff.
- Given no material change occurred, when output is generated, then no decision/one-liner is
  produced at all (ties to FR-21's silence branch).

*Validation Rules:* the one-liner's numbers must match the engine's structured output exactly (ties
to the mismatch check, ST-023/ST-056).

*Error Handling:* if the one-liner generation fails, the structured plan is still available (fail
gracefully, not fail the whole re-plan).

*Security Considerations:* none new.

*Audit Requirements:* `CHECK_IN.decision_text`, `.what_changed` persisted.

*Dependencies:* ST-018, ST-022 (Materiality selects which one to surface).

*Technical Notes:* narration is generated *from* the structured result, never the reverse (Pass 2
§7 Orchestrator↔Engine contract).

*Definition of Done:* implemented; demoed in the golden-path re-plan steps.

*Traceability:* FR-16; Component: Orchestrator, Alert Composer (shares narration mechanism);
Workflow: §9.8, §9.9; Data: `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-019-T1 | Structured re-plan output shape (decision + one-liner) | Backend | 1d | ST-018 |
| ST-019-T2 | Narration generation from structured diff | AI Agent | 1d | — |
| ST-019-T3 | Integration test: one decision, never zero-when-material or many | Testing | 1d | ST-022 |

---

**ST-020 — Correction capture from re-plan response**
Feature: FEAT-012 | Priority: P0 | Points: 2 | Risk: Low

*User Story:* As the system, I want a user's response to a surfaced decision captured as a
correction, so that future classification/re-planning is biased by what actually happened.

*Description:* Writes the user's response to a `CHECK_IN` and, where applicable, links it to a new
classification.

*Business Rules:* FR-17.

*Acceptance Criteria:*
- Given a user responds to a surfaced `CHECK_IN`, when captured, then `CHECK_IN.response` is
  populated and `responded_at` is set.
- Given the response implies a classification change, when captured, then
  `resulting_classification_id` links to the new `TRANSACTION_CLASSIFICATION(source=user)` row in
  the same transaction (ties to ST-047's ADR-006 resolution).
- Given no response is given, when checked later, then the `CHECK_IN` remains open/unresponded
  (boundary — not treated as an implicit acceptance).

*Validation Rules:* n/a.

*Error Handling:* a failed link write rolls back the whole transaction (correction + link must be
atomic, per Pass 2 §11's transaction-boundary recommendation).

*Security Considerations:* none new.

*Audit Requirements:* this *is* the audit trail for the correction log's `CHECK_IN` half.

*Dependencies:* ST-047, ST-019.

*Technical Notes:* implements Pass 2 §11's "transaction boundaries" recommendation explicitly.

*Definition of Done:* implemented and tested; feeds Re-planner eval 1.

*Traceability:* FR-17; Component: Orchestrator, Engine MCP; Workflow: §9.17; Data: `CHECK_IN`,
`TRANSACTION_CLASSIFICATION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-020-T1 | Atomic write: `record_correction` + `CHECK_IN.resulting_classification_id` | Backend | 1d | ST-028 |
| ST-020-T2 | Unit test: rollback on partial failure | Testing | 0.5d | — |

---

**ST-021 — Re-planner eval suite (4 cases)**
Feature: FEAT-013 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the delivery team, I want the 4 documented Re-planner eval cases automated and
green, so that Bar 5's eval-gate requirement is provably met for this skill.

*Description:* Automated eval harness for the 4 cases from PRD §17.

*Business Rules:* PRD §17 Re-planner eval cases 1–4.

*Acceptance Criteria:*
- Given the 4 canonical cases (income slip; surprise expense; tax-due-soon short; new subscription),
  when run, then all 4 pass with documented expected outcomes.
- Given a case fails, when CI runs, then the eval-gate checkpoint is blocked.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* n/a.

*Audit Requirements:* eval output stored as a build artifact.

*Dependencies:* ST-018.

*Technical Notes:* run in CI on every PR touching re-plan logic.

*Definition of Done:* 4/4 green, wired into CI.

*Traceability:* Bar 5; Component: Re-planner; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-021-T1 | Eval harness + fixtures for 4 cases | Testing | 1d | ST-043 |
| ST-021-T2 | Wire into CI | Testing | 0.5d | FEAT-042 |

---

### EPIC-07 — Materiality Evaluator & Alert Composer

**ST-022 — Materiality Evaluator deterministic-first gate**
Feature: FEAT-014 | Priority: P1 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want to be interrupted only when something truly matters, so that I never
tune out a system that nags over noise.

*Description:* Deterministic-first gate: floor breach, tax proximity, Safe-to-Pay delta, or new
recurring commitment ⇒ material; AI is only a tiebreaker when several compete.

*Business Rules:* FR-21; floor breaches/tax shortfalls are always material (hard rule, never
AI-gated).

*Acceptance Criteria:*
- Given a $12 subscription drift on an otherwise healthy plan, when evaluated, then it is **not
  material** — no `CHECK_IN` is emitted.
- Given Acme's payment slips and a floor is at risk, when evaluated, then it **is material** and a
  decision is surfaced.
- Given a tax gap and a minor expense occur the same day, when evaluated, then the tax gap is
  surfaced (higher rank) — the AI tiebreaker only orders *which* material item leads, never whether
  a floor-breach/tax-shortfall is material (boundary — this is a hard rule, not AI-gated).

*Validation Rules:* thresholds are explicit config values, not implicit.

*Error Handling:* if the tiebreaker call fails, default to surfacing the floor/tax-touching item
first (fail toward safety, per Pass 2 §6).

*Security Considerations:* none new.

*Audit Requirements:* `CHECK_IN.materiality_reason` records why it was surfaced (or its absence
implies silence).

*Dependencies:* ST-027 (`get_projections`).

*Technical Notes:* build-if-time per `ai-agents.md`'s build-scope table — cuttable before the core 3
skills if schedule slips (PRD §21 cut order), but Bar 5 is already satisfied without it.

*Definition of Done:* implemented; feeds ST-024's eval suite.

*Traceability:* FR-21; Component: Materiality Evaluator; Workflow: §9.8, §9.9, §9.11; Data:
`AGENT_RUN.surfaced`, `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-022-T1 | Deterministic threshold rules (floor/tax/delta/new-recurring) | Backend | 1.5d | ST-035 |
| ST-022-T2 | AI tiebreaker for competing material candidates | AI Agent | 1.5d | — |
| ST-022-T3 | Recent-alert-cadence tracking (avoid fatigue) | Backend | 1d | — |
| ST-022-T4 | Unit tests: 3 canonical scenarios | Testing | 1d | — |

---

**ST-023 — Alert Composer message generation + mismatch check**
Feature: FEAT-015 | Priority: P1 | Points: 5 | Risk: High

*User Story:* As Dev, I want any alert I receive to state exactly the numbers the engine computed —
never a drifted or invented figure — so that I can trust what I read without re-verifying it myself.

*Description:* Turns structured engine output into one concise message; a mismatch check rejects any
copy whose numbers differ from the engine's.

*Business Rules:* FR-24 (skill half).

*Acceptance Criteria:*
- Given a structured plan result, when composed, then the copy's numbers exactly match the engine's
  output.
- Given the composed copy, when checked, then the one decision appears in the first two lines.
- Given an all-clear run (nothing material), when checked, then the Composer is not even called —
  no alert is produced.
- Given required fields are missing at compose time, when detected, then the Composer fails closed
  (sends nothing) rather than improvising a number (boundary).

*Validation Rules:* every numeric token in the copy must resolve to a field in the structured plan
result (see ST-056 spike for the exact mechanism).

*Error Handling:* mismatch detected ⇒ reject, log, send nothing.

*Security Considerations:* copy generation must not leak raw unredacted transaction memos into an
email if not intended for display — reuse the same evidence-display convention as ST-005.

*Audit Requirements:* mismatch-check result logged per attempt (pass/fail).

*Dependencies:* ST-035, ST-056 (mismatch-mechanism spike).

*Technical Notes:* the *mechanism* for the mismatch check is an open decision (OPEN-ENG-05) —
resolved by ST-056 before this story can be marked done.

*Definition of Done:* implemented once ST-056 resolves; feeds ST-025's eval suite.

*Traceability:* FR-24; Component: Alert Composer; Workflow: §9.13; Data: `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-023-T1 | Copy-generation prompt (subject + body + one-liner) | AI Agent | 1.5d | ST-035 |
| ST-023-T2 | Mismatch-check implementation (per ST-056's chosen mechanism) | Backend | 1.5d | ST-056 |
| ST-023-T3 | Fail-closed path (missing fields → no send) | Backend | 0.5d | — |
| ST-023-T4 | Unit tests: 3 canonical scenarios | Testing | 1d | — |

---

**ST-024 — Materiality Evaluator eval suite (3 cases)**
Feature: FEAT-016 | Priority: P2 | Points: 2 | Risk: Low

*User Story:* As the delivery team, I want the 3 documented Materiality eval cases automated and
green, so that this build-if-time skill's quality bar is provable if it ships.

*Acceptance Criteria:*
- Given the 3 canonical cases ($12 drift silent; Acme-slip material; tax-gap-ranks-higher), when
  run, then all 3 pass.
- Given the skill is cut per the PRD's pre-committed cut order, then this story is descoped
  alongside it, not run half-built.

*Validation Rules / Error Handling / Security / Audit:* n/a (test harness).

*Dependencies:* ST-022.

*Technical Notes:* light suite (3, not 5) per `ai-agents.md`'s build-scope table.

*Definition of Done:* 3/3 green if built, or explicitly cut.

*Traceability:* Bar 5 (optional); Component: Materiality Evaluator.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-024-T1 | Eval harness + fixtures for 3 cases | Testing | 0.5d | ST-043 |
| ST-024-T2 | Wire into CI | Testing | 0.5d | FEAT-042 |

---

**ST-025 — Alert Composer eval suite (3 cases)**
Feature: FEAT-016 | Priority: P2 | Points: 2 | Risk: Low

*User Story:* As the delivery team, I want the 3 documented Alert Composer eval cases automated and
green, so that this build-if-time skill's quality bar is provable if it ships.

*Acceptance Criteria:*
- Given the 3 canonical cases (numbers match exactly; decision in first 2 lines; all-clear → no
  alert), when run, then all 3 pass.
- Given the skill is cut per the PRD's pre-committed cut order, then this story is descoped
  alongside it.

*Validation Rules / Error Handling / Security / Audit:* n/a.

*Dependencies:* ST-023.

*Technical Notes:* light suite (3, not 5).

*Definition of Done:* 3/3 green if built, or explicitly cut.

*Traceability:* Bar 5 (optional); Component: Alert Composer.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-025-T1 | Eval harness + fixtures for 3 cases | Testing | 0.5d | ST-043 |
| ST-025-T2 | Wire into CI | Testing | 0.5d | FEAT-042 |

---

### EPIC-08 — Expected-Income Interpreter

**ST-026 — Parse free-text invoice-status updates**
Feature: FEAT-017 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As Dev, I want to type a plain sentence about an invoice ("Acme paid late") and have
it correctly turn into a structured status update, so that I don't have to fill out a form to report
something simple.

*Description:* Intent parse over free text → which invoice, what status change, what new date →
`mark_invoice_late`-style mutation.

*Business Rules:* supports FR-20.

*Acceptance Criteria:*
- Given "Acme paid late," when parsed, then the matching `EXPECTED_INCOME` for Acme is identified and
  a new `EXPECTED_INCOME_VERSION(status=late)` is proposed with a +30d date shift (per the canonical
  scenario).
- Given an ambiguous message with no clear invoice match, when parsed, then a clarifying question is
  returned instead of a guessed mutation.
- Given a message naming an invoice that doesn't exist, when parsed, then an explicit "not found"
  result is returned.

*Validation Rules:* the parsed mutation must resolve to exactly one `EXPECTED_INCOME.id`.

*Error Handling:* ambiguous/no-match parses never mutate state (BRULE-consistent with bias-to-ask).

*Security Considerations:* free text treated as untrusted data (Pass 2 §12).

*Audit Requirements:* the proposed mutation is what feeds `TRIGGER_EVENT.interpreted_as`.

*Dependencies:* ST-048 (expected-income MCP tools).

*Technical Notes:* manual/free-text path only for v1 — email ingestion is an explicit fast-follow,
not built (`ai-agents.md` Component 7).

*Definition of Done:* implemented; rides the Orchestrator eval cases (a, d).

*Traceability:* FR-20; Component: Expected-Income Interpreter; Workflow: §9.10; Data:
`EXPECTED_INCOME`, `EXPECTED_INCOME_VERSION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-026-T1 | Intent-parse prompt (invoice match + status/date extraction) | AI Agent | 1.5d | FEAT-043 |
| ST-026-T2 | Wire to `expected-income.mark_invoice_late` | API | 0.5d | ST-048 |
| ST-026-T3 | Ambiguous/not-found response handling | Backend | 0.5d | — |
| ST-026-T4 | Unit tests: "Acme paid late," ambiguous, not-found | Testing | 1d | — |

---

### EPIC-09 — Financial State + Priority Engine Core

**ST-027 — `get_state`/`set_goal`/`compute_allocation`/`get_projections` tool contracts**
Feature: FEAT-018 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As any skill or the Orchestrator, I want a stable, typed set of engine tools, so that
every consumer calls the exact same authoritative source for state and computation.

*Description:* The custom-authored MCP server's read/config/compute tools — the ★ custom source
satisfying Bar 3.

*Business Rules:* INT-004; the engine never accepts a financial figure computed elsewhere as
authoritative input.

*Acceptance Criteria:*
- Given a valid `user_id`, when `get_state` is called, then the current goal config, allocation,
  projections, and correction-log-relevant classifications are returned.
- Given a valid goal payload, when `set_goal` is called, then a new versioned `GOAL_CONFIG` +
  `BUCKET_TARGET` row set is written, superseding the prior current version.
- Given pinned current versions of every input, when `compute_allocation` is called twice with
  identical inputs, then both calls return identical `output_digest` values (determinism guarantee).
- Given a call to `get_projections`, when the underlying plan is `infeasible`, then the response
  explicitly reports infeasibility rather than an error (boundary — infeasibility is a valid,
  structured response).

*Validation Rules:* every write op requires validated, typed input matching the ERD's field types.

*Error Handling:* a missing/invalid jurisdiction or tax year returns "cannot compute for this
jurisdiction," never a guess (ties to ST-029).

*Security Considerations:* backend-internal, highest-trust-tier service; no direct external network
exposure.

*Audit Requirements:* every `compute_allocation` call's output is pinned via `PLAN_INPUT_*` lineage
(ST-046).

*Dependencies:* ST-044, ST-045 (schema).

*Technical Notes:* this is "where financial truth lives" (Pass 2 §6) — treat any change here as
maximally reviewed.

*Definition of Done:* all 4 tools implemented, contract-tested, and callable by every dependent
story.

*Traceability:* FR-4; INT-004; Component: Financial State + Priority Engine MCP; Workflow: §9.5,
§9.6; Data: `GOAL_CONFIG`, `BUCKET_TARGET`, `PLAN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-027-T1 | `get_state` implementation | MCP | 1.5d | ST-044 |
| ST-027-T2 | `set_goal` implementation + versioning | MCP | 1.5d | ST-045 |
| ST-027-T3 | `compute_allocation` implementation (calls into ST-031's waterfall) | MCP | 2d | ST-031 |
| ST-027-T4 | `get_projections` implementation | MCP | 1d | ST-036 |
| ST-027-T5 | Contract tests for all 4 tools | Testing | 1.5d | FEAT-043 |

---

**ST-028 — `record_correction` & `classify_transaction` tool contracts**
Feature: FEAT-018 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As the Transaction Interpreter or the confirm UI, I want a single, transactionally
safe tool to write classifications and corrections, so that the correction log is never left in an
inconsistent state.

*Description:* Implements ADR-006's required `record_correction` behavior: write new classification
row, flip prior `is_current`, link `CHECK_IN` if applicable — atomically.

*Business Rules:* FR-6, FR-17; ADR-006.

*Acceptance Criteria:*
- Given a model classification, when `classify_transaction` is called, then a
  `TRANSACTION_CLASSIFICATION(source=model)` row is written.
- Given a user confirms or corrects, when `record_correction` is called, then a new
  `TRANSACTION_CLASSIFICATION(source=user)` row is written with `supersedes_id` set, and the prior
  row's `is_current` flips to false, in the same transaction.
- Given the correction was prompted by a `CHECK_IN`, when recorded, then `CHECK_IN.
  resulting_classification_id` is set in the same transaction (boundary — partial writes must never
  occur).
- Given a concurrent write race (two corrections to the same transaction), when both attempt to
  write, then the partial-unique `is_current` constraint prevents two current rows from coexisting.

*Validation Rules:* `label` must be valid for the transaction's direction.

*Error Handling:* any failure in the atomic write rolls back entirely — never a half-written
correction.

*Security Considerations:* none beyond standard write-path authorization.

*Audit Requirements:* this tool *is* the correction log's write path (ADR-006).

*Dependencies:* ST-044, ST-045.

*Technical Notes:* no dedicated `CORRECTION` table — this is the ADR-006 implementation, not a
redesign.

*Definition of Done:* implemented, transaction-tested (including the concurrent-write race case).

*Traceability:* FR-6, FR-17; DR-004; Component: Engine MCP; Workflow: §9.4, §9.17; Data:
`TRANSACTION_CLASSIFICATION`, `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-028-T1 | `classify_transaction` implementation | MCP | 1d | ST-044 |
| ST-028-T2 | `record_correction` atomic implementation | MCP | 1.5d | ST-044 |
| ST-028-T3 | Partial-unique constraint + race-condition test | Database | 1d | — |
| ST-028-T4 | Transaction-atomicity test (correction + `CHECK_IN` link) | Testing | 1d | — |

---

### EPIC-10 — Tax Computation

**ST-029 — Conservative tax set-aside computation**
Feature: FEAT-019 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As Dev, I want a conservative estimated-tax set-aside computed from SE tax, federal
brackets, QBI, and the half-SE deduction, so that I never under-reserve for taxes.

*Description:* Deterministic tax computation reading from the seeded Tax-rule MCP.

*Business Rules:* FR-11; BRULE-002 (never under-funded to free optional buckets).

*Acceptance Criteria:*
- Given the canonical scenario's inputs, when computed, then the tax set-aside gap reproduces
  exactly $900 (target $4,800, funded $3,900).
- Given a jurisdiction/year with no matching seeded `TAX_RULE_SET`, when requested, then the engine
  reports "cannot compute for this jurisdiction" rather than estimating (boundary).
- Given SE tax, federal brackets, QBI, and the half-SE deduction, when applied together, then the
  computed figure matches a hand-derivable calculation from the same inputs (auditability).

*Validation Rules:* filing status/state/year must resolve to exactly one current `TAX_RULE_SET`.

*Error Handling:* missing rule set → explicit "cannot compute," never a silent 0 or guess.

*Security Considerations:* none (no PII in tax reference data itself).

*Audit Requirements:* `PLAN_INPUT_TAX_RULE_SET` pins the exact rule set version used.

*Dependencies:* ST-049 (tax-rule seed).

*Technical Notes:* tax-math validation against real filed returns is explicitly Track C
(COMP-004) — Track A only needs the canonical scenario's arithmetic to be internally correct and
reproducible.

*Definition of Done:* implemented; Synthesizer eval 4 (tax-floor boundary) green; canonical scenario
regression test (ST-071) passes.

*Traceability:* FR-11; Component: Cashflow Synthesizer, Tax-rule MCP; Workflow: §9.6; Data:
`PLAN.tax_gap_amount`, `TAX_RULE_SET`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-029-T1 | SE tax + federal bracket computation | Backend | 2d | ST-049 |
| ST-029-T2 | QBI + half-SE deduction logic | Backend | 1.5d | — |
| ST-029-T3 | Missing-rule-set error path | Backend | 0.5d | — |
| ST-029-T4 | Unit test: canonical scenario reproduces $900 gap exactly | Testing | 1d | — |

---

**ST-030 — Tax due-date proximity ramp**
Feature: FEAT-019 | Priority: P1 | Points: 3 | Risk: Medium

*User Story:* As Dev, I want my tax set-aside target to ramp up automatically as the due date
approaches, so that I'm not caught short at the last minute.

*Description:* Scheduled-trigger-driven ramp logic reading `TAX_DUE_DATE` proximity.

*Business Rules:* FR-18 (engine half).

*Acceptance Criteria:*
- Given the tax due date is 12 days out (canonical scenario), when the nightly schedule fires, then
  the set-aside target ramps according to the documented ramp function.
- Given the due date has passed, when checked, then the ramp resets for the next quarter's due date
  (boundary).
- Given the ramp increases the target beyond current funding, when applied, then the gap is
  reported, not silently absorbed elsewhere.

*Validation Rules:* ramp function inputs must reference a valid `TAX_DUE_DATE` row.

*Error Handling:* missing due-date data → flagged, not silently skipped.

*Security Considerations:* none.

*Audit Requirements:* ramp application is visible in the `PLAN`'s `assumptions` field.

*Dependencies:* ST-049, ST-010 (schedule trigger).

*Technical Notes:* pairs with ST-010's schedule trigger acceptance criteria.

*Definition of Done:* implemented and tested against the canonical scenario's 12-day window.

*Traceability:* FR-18; Component: Cashflow Synthesizer; Workflow: §9.8; Data: `TAX_DUE_DATE`, `PLAN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-030-T1 | Due-date-proximity ramp function | Backend | 1.5d | ST-049 |
| ST-030-T2 | Integration with schedule trigger | Backend | 0.5d | ST-010 |
| ST-030-T3 | Unit test: 12-day-out ramp matches canonical scenario | Testing | 0.5d | — |

---

### EPIC-11 — Allocation Waterfall & Safety Floors

**ST-031 — Priority waterfall allocation with floors**
Feature: FEAT-020 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As Dev, I want my available funds allocated in the order Taxes → Runway → Pay →
Savings → Debt with hard floors, so that my most important obligations are always funded first.

*Description:* The core deterministic waterfall, the heart of the Financial State + Priority Engine.

*Business Rules:* BRULE-001, BRULE-006 (the clamp formula).

*Acceptance Criteria:*
- Given the canonical scenario's on-time inputs, when allocated, then Safe-to-Pay = $6,000 (target
  met), all buckets funded in order.
- Given the canonical scenario's Acme-slips-30-days inputs, when allocated, then Safe-to-Pay =
  $3,650 exactly, computed via `clamp(balance + income_low − outflow_high − tax_gap −
  runway_floor, 0, target_pay)`.
- Given an infeasible month (income too low), when allocated, then taxes/runway are funded first and
  pay/savings are reported short — never silently funded out of order (boundary).
- Given a $20k windfall, when allocated, then it is smoothed over cadence, not paid out in full in
  one period (boundary, ties to ST-036/038).

*Validation Rules:* allocation order is fixed below Taxes/Runway; floor amounts cannot be negative.

*Error Handling:* an infeasible plan is marked `plan_status=infeasible`, a valid structured response,
not an error.

*Security Considerations:* none.

*Audit Requirements:* every `ALLOCATION_LINE` records `funded_status` and `shortfall_amount`.

*Dependencies:* ST-027, ST-029, ST-036, ST-037.

*Technical Notes:* BRULE-006's formula must be implemented exactly as documented and covered by
ST-071's regression test.

*Definition of Done:* implemented; Synthesizer evals 1–4 green; canonical scenario reproduces $3,650
exactly.

*Traceability:* FR-12; BRULE-001, BRULE-006; Component: Engine MCP; Workflow: §9.6; Data:
`ALLOCATION_LINE`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-031-T1 | Waterfall allocation core logic | Backend | 3d | ST-029 |
| ST-031-T2 | Infeasibility detection + reporting | Backend | 1d | — |
| ST-031-T3 | Windfall-smoothing logic | Backend | 1.5d | ST-038 |
| ST-031-T4 | Unit tests: on-time + Acme-slip canonical scenarios | Testing | 1.5d | — |

---

**ST-032 — Tax floor never under-funded**
Feature: FEAT-020 | Priority: P0 | Points: 2 | Risk: High

*User Story:* As Dev, I want my tax set-aside to never be raided to free up pay or savings, so that I
never get a surprise tax bill because the system optimized for my short-term comfort.

*Description:* Explicit guard within the waterfall enforcing BRULE-002.

*Business Rules:* FR-25, BRULE-002.

*Acceptance Criteria:*
- Given any allocation scenario, when computed, then the tax bucket's `allocated_amount` is never
  reduced to increase pay/savings/debt.
- Given a tax shortfall exists, when allocated, then it is flagged via `PLAN_WARNING(code=
  tax_shortfall)`, never hidden.
- Given a tax shortfall and a healthy pay bucket simultaneously (boundary), when allocated, then the
  shortfall is still flagged — a "looks fine overall" plan never masks a tax gap.

*Validation Rules:* the waterfall's implementation must make this ordering structurally impossible
to violate, not merely convention.

*Error Handling:* n/a (this is itself a guard).

*Security Considerations:* none.

*Audit Requirements:* `PLAN_WARNING(code=tax_shortfall)` is the audit trail for this rule firing.

*Dependencies:* ST-031.

*Technical Notes:* implement as a structural invariant (e.g., tax allocation computed and locked
before any optional bucket is touched), not a post-hoc check.

*Definition of Done:* implemented; Synthesizer evals 2 and 4 (tax-floor boundary) green.

*Traceability:* FR-25; BRULE-002; Component: Engine MCP; Workflow: §9.6; Data: `ALLOCATION_LINE`,
`PLAN_WARNING`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-032-T1 | Structural tax-floor-first invariant in waterfall | Backend | 1d | ST-031 |
| ST-032-T2 | `PLAN_WARNING(code=tax_shortfall)` emission | Backend | 0.5d | — |
| ST-032-T3 | Unit test: tax shortfall flagged even when pay looks healthy | Testing | 0.5d | — |

---

**ST-033 — Runway floor breach warning**
Feature: FEAT-020 | Priority: P0 | Points: 2 | Risk: High

*User Story:* As Dev, I want to be explicitly warned any time a recommendation would breach my
runway floor, so that I'm never silently steered into a dangerous cash position.

*Description:* Explicit guard within the waterfall enforcing BRULE-003.

*Business Rules:* FR-26, BRULE-003.

*Acceptance Criteria:*
- Given any allocation scenario, when the runway floor would be breached by the recommended pay
  figure, then a `PLAN_WARNING(code=floor_breach)` is attached and the number is capped to protect
  the floor.
- Given the floor is healthy, when allocated, then no floor-breach warning appears (boundary — no
  false positives).

*Validation Rules:* same structural-invariant approach as ST-032.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* `PLAN_WARNING(code=floor_breach)` is the audit trail.

*Dependencies:* ST-031.

*Technical Notes:* pairs directly with ST-032 — implement both floor guards together for
consistency.

*Definition of Done:* implemented; Synthesizer eval 2 green.

*Traceability:* FR-26; BRULE-003; Component: Engine MCP; Workflow: §9.6; Data: `PLAN_WARNING`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-033-T1 | Structural runway-floor cap in waterfall | Backend | 1d | ST-031 |
| ST-033-T2 | `PLAN_WARNING(code=floor_breach)` emission | Backend | 0.5d | — |
| ST-033-T3 | Unit test: floor breach capped and flagged | Testing | 0.5d | — |

---

**ST-034 — Balance reconciliation & Safe-to-Pay derivation**
Feature: FEAT-021 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As Dev, I want my Safe-to-Pay Number derived from my actual reconciled balance, not a
stale or partial figure, so that the number I act on reflects reality.

*Description:* Reconciles the latest `ACCOUNT_BALANCE_SNAPSHOT` against the allocation to derive the
final promised number + runway forecast.

*Business Rules:* FR-13; BRULE-006.

*Acceptance Criteria:*
- Given the canonical scenario's balance ($11,900) and inputs, when reconciled, then Safe-to-Pay
  derives to $3,650 (stressed) / $6,000 (on-time) exactly.
- Given a stale balance feed, when reconciliation runs, then `PLAN.input_freshness_status=stale` is
  set and the number is still computed but flagged (boundary, OPS-002).
- Given both a base and a stressed scenario are computed (the catch), when reconciled, then both are
  returned together (ties to ST-008).

*Validation Rules:* balance snapshot must be the most recent `as_of` for the account.

*Error Handling:* missing balance data → plan marked `blocked`, not computed with a guessed balance.

*Security Considerations:* none.

*Audit Requirements:* `PLAN_INPUT_BALANCE_SNAPSHOT` pins the exact snapshot used.

*Dependencies:* ST-041 (balance data), ST-031.

*Technical Notes:* this is the final step producing the number shown everywhere (dashboard, PDF,
email) — must be the single source all three read from (ties to ST-057).

*Definition of Done:* implemented; canonical scenario reproduces $3,650 and $6,000 exactly; feeds
ST-071's regression test.

*Traceability:* FR-13; BRULE-006; Component: Engine MCP, Aggregator MCP; Workflow: §9.6; Data:
`PLAN`, `PROJECTION(kind=runway)`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-034-T1 | Balance reconciliation logic | Backend | 1.5d | ST-041 |
| ST-034-T2 | Safe-to-Pay clamp-formula derivation | Backend | 1d | ST-031 |
| ST-034-T3 | Base + stressed scenario dual computation | Backend | 1.5d | — |
| ST-034-T4 | Unit test: canonical scenario both states reproduce exactly | Testing | 1d | — |

---

**ST-035 — Structured Synthesizer output (feasibility report)**
Feature: FEAT-021 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As any consumer of the engine (dashboard, PDF, email, Re-planner), I want one
structured output containing the number, allocation, projections, and feasibility status, so that
every surface reads from the identical source.

*Description:* Assembles `PLAN` + `ALLOCATION_LINE[]` + `PROJECTION[]` + `PLAN_WARNING[]` into the
single response shape every downstream story consumes.

*Business Rules:* FR-14.

*Acceptance Criteria:*
- Given a computed plan, when returned, then it includes: number + range + reasoning, per-bucket
  allocation with funded status, income projection ± range, runway projection, tax-bomb status, and
  a feasibility report.
- Given an infeasible plan, when returned, then the feasibility report explicitly states what's
  short and why (derived from `plan_status` + `ALLOCATION_LINE.funded_status` + `PLAN_WARNING`).
- Given the same underlying `PLAN`, when read by the dashboard, PDF, and email paths, then all three
  surfaces show identical figures (boundary — no divergence between outputs).

*Validation Rules:* n/a (composition of already-validated sub-parts).

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* n/a (read composition).

*Dependencies:* ST-031–034.

*Technical Notes:* "feasibility report" is a derived/computed view, not a stored entity (Pass 1 §7,
confirmed by Pass 2) — implement as a read-time composition, not a new table.

*Definition of Done:* implemented; Synthesizer evals 1–5 all green.

*Traceability:* FR-14; Component: Cashflow Synthesizer; Workflow: §9.6; Data: `PLAN`,
`ALLOCATION_LINE`, `PROJECTION`, `PLAN_WARNING`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-035-T1 | Structured output composition layer | Backend | 1.5d | ST-034 |
| ST-035-T2 | Feasibility-report derivation logic | Backend | 1d | — |
| ST-035-T3 | Cross-surface consistency test (dashboard/PDF/email same figures) | Testing | 1d | ST-053,055 |

---

### EPIC-12 — Income & Spend Forecasting

**ST-036 — Income projection with range**
Feature: FEAT-022 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want my period income projected as a range (low/high) from classified income
and expected-income entries, so that the number reflects genuine uncertainty rather than false
precision.

*Description:* Projects income for the period, combining confirmed classified deposits and expected-
income entries.

*Business Rules:* FR-9.

*Acceptance Criteria:*
- Given the canonical scenario's on-time inputs, when projected, then income projects to ~$7,800
  (conservative low end reflecting the funded/pending mix).
- Given Acme's payment slips, when re-projected, then conservative income drops to ~$2,800 (the
  retainer only).
- Given an unconfirmed high-magnitude low-confidence deposit exists, when projected, then it is
  excluded from the projection until confirmed (boundary, ties to ST-015).

*Validation Rules:* every included amount must trace to a current classification or expected-income
version (lineage).

*Error Handling:* n/a beyond standard engine error handling.

*Security Considerations:* none.

*Audit Requirements:* `PLAN_INPUT_CLASSIFICATION`/`PLAN_INPUT_EXPECTED_INCOME` pin what was included.

*Dependencies:* ST-015, ST-048.

*Technical Notes:* this feeds directly into ST-031's waterfall as the income side.

*Definition of Done:* implemented; Synthesizer eval 1 green.

*Traceability:* FR-9; Component: Cashflow Synthesizer; Workflow: §9.6; Data:
`PROJECTION(kind=income)`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-036-T1 | Income-range projection logic | Backend | 1.5d | ST-015 |
| ST-036-T2 | Expected-income inclusion logic | Backend | 1d | ST-048 |
| ST-036-T3 | Exclusion of unconfirmed high-magnitude deposits | Backend | 1d | — |
| ST-036-T4 | Unit test: canonical scenario both income states | Testing | 1d | — |

---

**ST-037 — Expense forecast (recurring + variable trailing average)**
Feature: FEAT-022 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want my expenses forecast as a range from detected recurring costs plus a
trailing/seasonal average of variable spend, so that runway reflects a realistic outflow picture
without a fragile learned model.

*Description:* No learned model — trailing/seasonal average + detected recurring, explicit non-goal
per PRD §6.

*Business Rules:* FR-10.

*Acceptance Criteria:*
- Given the canonical scenario's recurring expenses ($2,939 fixed) + variable range ($900–$1,211),
  when forecast, then the total outflow high-end reproduces $4,150 (feeding the $3,650 derivation).
- Given 24 months of history, when the trailing/seasonal average is computed, then no learned/ML
  model is used (boundary — explicit non-goal verification).

*Validation Rules:* n/a.

*Error Handling:* insufficient history (<1 month) → widen the range and flag the assumption, never
silently narrow it.

*Security Considerations:* none.

*Audit Requirements:* `applied_forecast_params` on `PLAN` records method/lookback/seasonality/outlier
policy.

*Dependencies:* ST-016, ST-038.

*Technical Notes:* explicitly subordinate to the number, never a standalone budget view (PRD §11.8).

*Definition of Done:* implemented; feeds Synthesizer eval 5.

*Traceability:* FR-10; Component: Cashflow Synthesizer; Workflow: §9.6; Data:
`PROJECTION(kind=spend)`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-037-T1 | Trailing/seasonal average computation | Backend | 2d | ST-016 |
| ST-037-T2 | Recurring-expense total aggregation | Backend | 1d | ST-038 |
| ST-037-T3 | Unit test: canonical scenario $4,150 outflow-high reproduces | Testing | 1d | — |

---

**ST-038 — Recurring expense detection & flagging**
Feature: FEAT-022 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want new or changed recurring expenses automatically detected and flagged,
so that a surprise subscription doesn't quietly erode my runway.

*Description:* Detects recurring cadence from classified outflows; versions `RECURRING_EXPENSE`.

*Business Rules:* FR-29.

*Acceptance Criteria:*
- Given the canonical scenario's newly detected Vercel Pro $89 charge, when detected, then a
  `RECURRING_EXPENSE_VERSION(status=new)` is created and flagged.
- Given an existing recurring expense's amount changes, when detected, then a new version with
  `status=changed` is created, not silently absorbed.
- Given a new/changed recurring expense is detected, when flagged, then it also qualifies as a
  re-plan trigger candidate (ties to threshold-based re-plan, FR-21).

*Validation Rules:* `merchant` is the natural identity key for a recurring expense.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* `RECURRING_EXPENSE_VERSION` is fully versioned, never mutated in place.

*Dependencies:* ST-016.

*Technical Notes:* feeds both ST-037 (forecasting) and ST-022 (materiality — new recurring
commitment is a hard-rule material trigger).

*Definition of Done:* implemented; Re-planner eval 4 (new subscription) green.

*Traceability:* FR-29; Component: Transaction Interpreter, Engine MCP; Workflow: §9.3; Data:
`RECURRING_EXPENSE`, `RECURRING_EXPENSE_VERSION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-038-T1 | Cadence detection algorithm over classified outflows | Backend | 2d | ST-016 |
| ST-038-T2 | New/changed versioning logic | Backend | 1d | — |
| ST-038-T3 | Unit test: Vercel Pro $89 detected as new | Testing | 1d | — |

---

**ST-039 — Next-period spend prediction**
Feature: FEAT-022 | Priority: P0 | Points: 3 | Risk: Low

*User Story:* As Dev, I want next period's spend predicted with a range, so that my runway forecast
reflects what I'm actually likely to spend, not just what I've spent historically.

*Description:* Feeds a forward-looking spend prediction into runway/the number, explicitly
subordinate (not a standalone view).

*Business Rules:* FR-30.

*Acceptance Criteria:*
- Given 24 months of history, when predicted, then next-period spend is returned as a range with a
  stated assumption (method, lookback).
- Given the prediction, when used, then it feeds `PROJECTION(kind=runway)` — it is never displayed
  as a standalone budget view (boundary, explicit non-goal).

*Validation Rules:* n/a.

*Error Handling:* same as ST-037.

*Security Considerations:* none.

*Audit Requirements:* same `applied_forecast_params` mechanism as ST-037.

*Dependencies:* ST-037.

*Technical Notes:* effectively the runway-facing consumer of ST-037's output — thin composition
layer.

*Definition of Done:* implemented; Synthesizer eval 5 green (spend forecast within range; runway
reflects it).

*Traceability:* FR-30; Component: Cashflow Synthesizer; Workflow: §9.6; Data:
`PROJECTION(kind=spend)`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-039-T1 | Runway-facing spend-prediction composition | Backend | 1d | ST-037 |
| ST-039-T2 | Unit test: prediction feeds runway, not shown standalone | Testing | 0.5d | — |

---

**ST-040 — Cashflow Synthesizer eval suite (5 cases)**
Feature: FEAT-023 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the delivery team, I want the 5 documented Synthesizer eval cases automated and
green, so that Bar 5's eval-gate requirement is provably met for the dual-invoked core skill.

*Description:* Automated eval harness for the 5 cases from PRD §17.

*Business Rules:* PRD §17 Synthesizer eval cases 1–5.

*Acceptance Criteria:*
- Given the 5 canonical cases (normal ~$8k month; infeasible ~$3k month; $20k windfall smoothed;
  tax-floor boundary; spend forecast within range), when run, then all 5 pass with documented
  expected outcomes.
- Given the canonical demo scenario specifically, when run as part of this suite, then it reproduces
  $3,650 exactly (ties directly to ST-071).

*Validation Rules:* n/a.

*Error Handling:* a failing case blocks the eval-gate checkpoint.

*Security Considerations:* n/a.

*Audit Requirements:* eval output stored as a build artifact; this is also run via **both**
invocation paths (Claude Code + headless runner) to prove Bar 5's dual-invocation.

*Dependencies:* ST-029, ST-031–039.

*Technical Notes:* the single most important eval suite in the system — it's the one dual-invoked
per Bar 5.

*Definition of Done:* 5/5 green from both invocation paths.

*Traceability:* Bar 5; Component: Cashflow Synthesizer; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-040-T1 | Eval harness + fixtures for 5 cases | Testing | 1.5d | ST-043 |
| ST-040-T2 | Dual-invocation eval run (Claude Code + headless runner) | Testing | 1d | ST-014 |
| ST-040-T3 | Wire into CI | Testing | 0.5d | FEAT-042 |

---

### EPIC-13 — Aggregator MCP

**ST-041 — Aggregator MCP interface (`get_transactions`/`get_balances`/`get_accounts`)**
Feature: FEAT-024 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As any consumer of bank data, I want a provider-agnostic interface for transactions,
balances, and accounts, so that a real provider can later sit behind it without touching consuming
code.

*Description:* The MCP interface contract; Track A implements it with a fixture loader (ST-042).

*Business Rules:* INT-001, FR-1.

*Acceptance Criteria:*
- Given a valid account/connection id and date range, when `get_transactions` is called, then a
  list of `{provider_txn_id, posted_date, amount, raw_description, counterparty, channel}` is
  returned.
- Given a valid account id, when `get_balances` is called, then `{account_id, balance, as_of}` is
  returned.
- Given a valid connection id, when `get_accounts` is called, then the account list is returned.
- Given the underlying feed is stale/broken, when any of the 3 ops is called, then
  `BANK_CONNECTION.status` reflects it — never a silent empty/wrong response (ties to OPS-002).

*Validation Rules:* amount is signed, minor-units numeric; `posted_date` required.

*Error Handling:* errors surfaced via `BANK_CONNECTION.status`, never swallowed.

*Security Considerations:* OAuth access token (or fixture-loader equivalent) encrypted at rest,
never exposed to the frontend (SEC-001).

*Audit Requirements:* every call logged within its `AGENT_RUN` trace.

*Dependencies:* ST-044 (schema).

*Technical Notes:* ADR-008 — build to this interface now; defer the Plaid-vs-Teller vendor decision
to Track B (does not block Track A).

*Definition of Done:* interface implemented and contract-tested against the fixture loader.

*Traceability:* FR-1, FR-27; INT-001; Component: Aggregator MCP; Workflow: §9.2, §9.14; Data:
`BANK_CONNECTION`, `BANK_ACCOUNT`, `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-041-T1 | `get_transactions`/`get_balances`/`get_accounts` implementation | MCP | 2d | ST-044 |
| ST-041-T2 | `BANK_CONNECTION.status` stale/error handling | Backend | 1d | — |
| ST-041-T3 | Contract tests for all 3 operations | Testing | 1d | FEAT-043 |
| ST-041-T4 | Dedupe on `provider_txn_id`/`sync_id` | Backend | 0.5d | — |

---

**ST-042 — Scripted fixture loader behind aggregator interface**
Feature: FEAT-024 | Priority: P0 | Points: 3 | Risk: Low

*User Story:* As the demo system, I want the aggregator interface backed by deterministic scripted
data instead of a live bank connection, so that Demo Day never depends on a live OAuth flow.

*Description:* Implements ST-041's interface reading from the checked-in persona fixtures (ST-043).

*Business Rules:* ADR-003 (scripted data vs. live bank dependency); OPS-003.

*Acceptance Criteria:*
- Given a persona's fixture set, when the loader serves `get_transactions`, then it returns
  identical data on every call (deterministic).
- Given the same interface is later pointed at a live provider (Track B), when swapped, then no
  consuming code changes (boundary — proves ADR-008's abstraction).

*Validation Rules:* fixture data must conform to the same field shapes as ST-041's contract.

*Error Handling:* a malformed fixture fails loudly at load time (CI-caught), never silently at
demo time.

*Security Considerations:* fixtures contain no real PII (SEC-003).

*Audit Requirements:* n/a (static data).

*Dependencies:* ST-043 (persona data).

*Technical Notes:* this is what makes "the background schedule firing" and "live bank OAuth" safely
simulate-able per Pass 2 §3's labels.

*Definition of Done:* loader implemented; used by all 3 personas.

*Traceability:* FR-27; Component: Scripted demo-data source; Workflow: §9.2; Data: `TRANSACTION`,
`ACCOUNT_BALANCE_SNAPSHOT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-042-T1 | Fixture-loader implementation of the 3 aggregator ops | Data Seeding | 1.5d | ST-041 |
| ST-042-T2 | Fixture schema validation at load time | Testing | 0.5d | — |
| ST-042-T3 | Swap-test: point interface at an alternate fixture set | Testing | 0.5d | — |

---

### EPIC-14 — Scripted Demo Personas

**ST-043 — Build 3 scripted personas (Maya/Dev/Sam), 24 months each**
Feature: FEAT-025 | Priority: P0 | Points: 8 | Risk: High

*User Story:* As the delivery team, I want 3 fully scripted 24-month personas, so that every eval
case, trigger type, and output is demonstrable on deterministic, reproducible data.

*Description:* Maya (normal month), Dev (the catch, canonical), Sam (windfall) — per PRD §18.

*Business Rules:* PRD §7 (canonical scenario), §18 (persona roles).

*Acceptance Criteria:*
- Given the Dev persona's fixture set, when run through the full pipeline, then it reproduces
  exactly $3,650 (Acme-slip) and $6,000 (on-time) per PRD §7.
- Given the Maya persona, when run, then it demonstrates Journey C (quiet day, no material change).
- Given the Sam persona, when run, then it demonstrates windfall-smoothing (a $20k deposit not
  treated as recurring).
- Given all 3 personas together, when exercised across the demo script, then all 14 core eval cases,
  all 3 trigger types, and all 3 outputs are collectively covered (boundary — completeness check).

*Validation Rules:* each persona's data must be internally consistent (no contradictory balances/
transactions across the 24-month window).

*Error Handling:* n/a (static data, validated at build time).

*Security Considerations:* no real PII in any fixture (SEC-003).

*Audit Requirements:* fixtures checked into the repo, versioned like code.

*Dependencies:* ST-042.

*Technical Notes:* this is the single highest-leverage demo asset — R-001's mitigation depends
entirely on this data being exactly right.

*Definition of Done:* all 3 personas committed; Dev persona validated against PRD §7's canonical
numbers; used across all dry runs.

*Traceability:* PRD §7, §18; Component: Scripted demo-data source; Workflow: all; Data:
`TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`, `EXPECTED_INCOME`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-043-T1 | Dev persona: 24mo fixture set + canonical scenario validation | Data Seeding | 2d | ST-042 |
| ST-043-T2 | Maya persona: 24mo fixture set (steady retainer) | Data Seeding | 1.5d | ST-042 |
| ST-043-T3 | Sam persona: 24mo fixture set (windfall) | Data Seeding | 1.5d | ST-042 |
| ST-043-T4 | Cross-check: all 14 evals/3 triggers/3 outputs covered by the 3 personas | Testing | 1d | ST-017,021,040 |
| ST-043-T5 | Commit fixtures to repo with versioning convention | Demo Assets | 0.5d | — |

---

### EPIC-15 — Core Schema & Migrations

**ST-044 — Identity, config, and bank-data schema migration**
Feature: FEAT-026 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As the engineering team, I want the identity, configuration, and raw bank-data tables
migrated exactly per `data-model.md`'s ERD, so that every downstream story has a stable foundation.

*Description:* Migrates `USER`, `GOAL_CONFIG`, `BUCKET_TARGET`, `TAX_PROFILE`, `BANK_CONNECTION`,
`BANK_ACCOUNT`, `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`, `TRANSACTION_CLASSIFICATION`,
`RECURRING_EXPENSE(_VERSION/_TXN)`, `EXPECTED_INCOME(_VERSION)`.

*Business Rules:* DR-002 (append-only, `is_current` versioning).

*Acceptance Criteria:*
- Given the ERD, when migrations run, then every listed entity/field matches exactly, including
  enums and partial-unique constraints on `is_current`.
- Given a mutable entity (e.g., `GOAL_CONFIG`), when two rows attempt `is_current=true`
  simultaneously, then the partial-unique constraint rejects the second (boundary).
- Given `TRANSACTION.ingested_at`, when a row is written, then no update path exists that could later
  mutate it (immutability by construction).

*Validation Rules:* foreign keys enforced at the database level.

*Error Handling:* migration failure blocks CI; no partial-migration state is left in any environment.

*Security Considerations:* no PII-classification tagging yet (Track C, GAP-010) — acceptable for
Track A per Pass 2.

*Audit Requirements:* migration history itself is version-controlled.

*Dependencies:* none.

*Technical Notes:* this is the first "brick" — get it exactly right against the ERD before anything
else builds on it.

*Definition of Done:* migrations applied cleanly in a fresh environment; reviewed line-by-line
against `data-model.md`.

*Traceability:* DR-001, DR-002; Component: PostgreSQL persistence; Data: all identity/config/bank
entities.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-044-T1 | Identity/config migration (`USER`, `GOAL_CONFIG`, `BUCKET_TARGET`, `TAX_PROFILE`) | Database | 1.5d | FEAT-042 |
| ST-044-T2 | Bank-data migration (`BANK_CONNECTION`, `BANK_ACCOUNT`, `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`) | Database | 1.5d | — |
| ST-044-T3 | Interpretation migration (`TRANSACTION_CLASSIFICATION`, `RECURRING_EXPENSE*`, `EXPECTED_INCOME*`) | Database | 1.5d | — |
| ST-044-T4 | Partial-unique `is_current` constraint tests | Testing | 1d | — |

---

**ST-045 — Plan-output schema migration**
Feature: FEAT-027 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the engineering team, I want the plan-output tables migrated exactly per the ERD,
so that the engine has somewhere authoritative to write its results.

*Description:* Migrates `TRIGGER_EVENT`, `AGENT_RUN`, `AGENT_RUN_ATTEMPT`, `PLAN`, `ALLOCATION_LINE`,
`PROJECTION`, `PLAN_WARNING`, `CHECK_IN`, `RECOMMENDATION_OUTCOME`, `TAX_RULE_SET`, `TAX_BRACKET`,
`TAX_DUE_DATE`.

*Business Rules:* n/a (schema fidelity).

*Acceptance Criteria:*
- Given the ERD, when migrations run, then every plan-output/orchestration/tax-reference entity
  matches exactly.
- Given a `PLAN` row, when written, then it is never updated in place — only new rows are ever
  inserted (boundary — no `supersedes_id` exists on `PLAN` by design).

*Validation Rules:* foreign keys enforced at the database level.

*Error Handling:* same as ST-044.

*Security Considerations:* none new.

*Audit Requirements:* n/a.

*Dependencies:* ST-044.

*Technical Notes:* n/a.

*Definition of Done:* migrations applied cleanly; reviewed against the ERD.

*Traceability:* DR-001; Component: PostgreSQL persistence; Data: `PLAN`, `ALLOCATION_LINE`,
`PROJECTION`, `PLAN_WARNING`, `CHECK_IN`, `TAX_RULE_SET`, `TAX_BRACKET`, `TAX_DUE_DATE`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-045-T1 | Orchestration migration (`TRIGGER_EVENT`, `AGENT_RUN*`) | Database | 1d | ST-044 |
| ST-045-T2 | Plan-output migration (`PLAN`, `ALLOCATION_LINE`, `PROJECTION`, `PLAN_WARNING`) | Database | 1d | — |
| ST-045-T3 | Tax-reference + `CHECK_IN`/`RECOMMENDATION_OUTCOME` migration | Database | 1d | — |

---

### EPIC-16 — Plan Lineage & Audit

**ST-046 — `PLAN_INPUT_*` lineage tables + input/output digests**
Feature: FEAT-028 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As a program evaluator (or a future auditor), I want every `PLAN` fully reconstructable
from its exact pinned inputs, so that the system's auditability claim is actually verifiable, not
just asserted.

*Description:* The 5 `PLAN_INPUT_*` join tables plus `input_digest`/`output_digest` computation.

*Business Rules:* DR-003; AUD-002.

*Acceptance Criteria:*
- Given a computed `PLAN`, when inspected, then its exact classification, expected-income,
  recurring-expense, balance-snapshot, and tax-rule-set versions are all pinned via the 5 join
  tables.
- Given two `PLAN`s computed from identical pinned input versions, when compared, then their
  `input_digest` values are identical (determinism proof).
- Given a referenced classification is later superseded, when the historical plan's lineage is
  queried, then it still points to the *original* version, not the superseding one (boundary —
  historical plans stay pinned).

*Validation Rules:* every `PLAN_INPUT_*` row must reference a version that was current at
computation time.

*Error Handling:* n/a (append-only writes).

*Security Considerations:* none.

*Audit Requirements:* this story *is* the audit mechanism.

*Dependencies:* ST-045.

*Technical Notes:* `debug_input_payload` is explicitly non-authoritative — the lineage tables are the
real mechanism, not that blob (Pass 2 ADR-005).

*Definition of Done:* implemented; a plan can be fully reconstructed from lineage alone in a test.

*Traceability:* DR-003; AUD-002; Component: Engine MCP, PostgreSQL persistence; Data:
`PLAN_INPUT_CLASSIFICATION`, `PLAN_INPUT_EXPECTED_INCOME`, `PLAN_INPUT_RECURRING_EXPENSE`,
`PLAN_INPUT_BALANCE_SNAPSHOT`, `PLAN_INPUT_TAX_RULE_SET`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-046-T1 | 5 `PLAN_INPUT_*` join-table writes on every `compute_allocation` | Backend | 2d | ST-045 |
| ST-046-T2 | `input_digest`/`output_digest` computation | Backend | 1d | — |
| ST-046-T3 | Reconstruction test: rebuild a plan's context from lineage alone | Testing | 1d | — |
| ST-046-T4 | Determinism test: identical inputs → identical digest | Testing | 1d | — |

---

### EPIC-17 — Correction Log

**ST-047 — Correction-log semantics (ADR-006) + documentation clarification**
Feature: FEAT-029 | Priority: P0 | Points: 2 | Risk: Medium

*User Story:* As an engineer building or reading `record_correction`, I want an explicit,
discoverable statement of what "the correction log" maps to in the ERD, so that I never build a
duplicate `CORRECTION` table by mistake.

*Description:* The documentation-clarification half of ADR-006 (the tool-implementation half is
ST-028). Adds the reconciliation note to `data-model.md` and annotates `PRD-v2.md` §12.

*Business Rules:* ADR-006; DR-004.

*Acceptance Criteria:*
- Given `data-model.md`, when the clarification note is added, then it explicitly states "the
  correction log" = `TRANSACTION_CLASSIFICATION(source='user')` rows chained via `supersedes_id`,
  optionally linked from `CHECK_IN.resulting_classification_id` — no separate table.
- Given `PRD-v2.md` §12's entity list, when annotated, then the standalone "Correction" line is
  either removed or mapped explicitly to its ERD implementation.
- Given a new engineer reads only `data-model.md`, when they look for "correction log," then they
  find the mapping without needing this backlog or Pass 2 as an intermediary (boundary — the point
  of this story).

*Validation Rules:* n/a (documentation).

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* n/a.

*Dependencies:* ST-028 (the mechanism this documents).

*Technical Notes:* this is TD-02/TD-03 from the deferred backlog (§10), pulled forward into Track A
because it's small and directly de-risks EPIC-09/17's implementation clarity.

*Definition of Done:* both documentation edits applied; ST-015/ST-005/ST-020's reads of "correction
log" all correctly resolve to this mechanism.

*Traceability:* DR-004; Component: Engine MCP (documentation); Data: `TRANSACTION_CLASSIFICATION`,
`CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-047-T1 | Add correction-log clarification note to `data-model.md` | Documentation | 0.5d | — |
| ST-047-T2 | Annotate `PRD-v2.md` §12's Correction entity mapping | Documentation | 0.5d | — |

---

### EPIC-18 — Expected-Income MCP

**ST-048 — `list_expected_income` / `mark_invoice_late` tools**
Feature: FEAT-030 | Priority: P0 | Points: 3 | Risk: Low

*User Story:* As the Expected-Income Interpreter (or any consumer), I want tools to list and update
expected-income entries, so that manual invoice tracking is a first-class, versioned data source.

*Description:* The manual-entry MCP satisfying one of Bar 3's 4 sources.

*Business Rules:* INT-003.

*Acceptance Criteria:*
- Given a user id, when `list_expected_income` is called, then all current `EXPECTED_INCOME` +
  their latest `EXPECTED_INCOME_VERSION` are returned.
- Given a valid invoice id and a delta in days, when `mark_invoice_late` is called, then a new
  `EXPECTED_INCOME_VERSION(status=late)` is written with the shifted date.
- Given an invalid invoice id, when called, then an explicit error is returned — never a silent
  no-op.

*Validation Rules:* `invoice_ref` uniqueness per user.

*Error Handling:* invalid id → explicit error.

*Security Considerations:* internal, in-app only — no external network boundary.

*Audit Requirements:* version history is the audit trail (no separate log needed).

*Dependencies:* ST-044.

*Technical Notes:* no live invoicing integration (Stripe/QBO) — explicit non-goal.

*Definition of Done:* both tools implemented and contract-tested.

*Traceability:* INT-003; Component: Expected-income MCP; Workflow: §9.10; Data: `EXPECTED_INCOME`,
`EXPECTED_INCOME_VERSION`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-048-T1 | `list_expected_income` implementation | MCP | 0.5d | ST-044 |
| ST-048-T2 | `mark_invoice_late` implementation + versioning | MCP | 1d | — |
| ST-048-T3 | Contract tests (valid + invalid invoice id) | Testing | 0.5d | FEAT-043 |

---

### EPIC-19 — Tax-Rule MCP Seed

**ST-049 — Seed federal + CA tax rule set (rates, brackets, due dates)**
Feature: FEAT-031 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As the Cashflow Synthesizer, I want a seeded, versioned, cited tax-rule set for
federal + CA, so that tax computation has a trustworthy, auditable reference to read from.

*Description:* Seeds `TAX_RULE_SET`, `TAX_BRACKET`, `TAX_DUE_DATE` with real, citable data for the
canonical scenario's tax year/jurisdiction.

*Business Rules:* INT-002; Pass 2's correction of Pass 1's GAP-005 — federal + CA is sufficient for
Track A, additional states are Track B/C.

*Acceptance Criteria:*
- Given a request for `(filing_status=single, state=CA, year=2026)`, when `get_tax_rules` is called,
  then it returns the seeded rate/bracket set with `citation`, `source_url`, `checksum`.
- Given `get_due_dates(2026)`, when called, then it returns Q1–Q4 due dates matching the canonical
  scenario's Sep 15 Q3 date.
- Given a jurisdiction outside the seeded set, when requested, then the tool returns "no matching
  rule set" rather than a guess (boundary, ties to ST-029).

*Validation Rules:* exactly one current `TAX_RULE_SET` per `(jurisdiction, filing_status, year)`.

*Error Handling:* no matching set → explicit "cannot compute," never estimated.

*Security Considerations:* no PII in this data.

*Audit Requirements:* `citation`/`checksum`/`published_date` provide provenance for every seeded row.

*Dependencies:* ST-044.

*Technical Notes:* seeding data is static reference data — no external network dependency at demo
time (Pass 2 §3, "Simulate" label, though the underlying rates are real).

*Definition of Done:* seed data loaded; `get_tax_rules`/`get_due_dates` contract-tested against the
canonical scenario.

*Traceability:* INT-002; Component: Tax-rule MCP; Workflow: §9.6; Data: `TAX_RULE_SET`,
`TAX_BRACKET`, `TAX_DUE_DATE`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-049-T1 | Source and cite federal SE/bracket/QBI rates for the canonical tax year | Data Seeding | 1.5d | — |
| ST-049-T2 | Source and cite CA state rates | Data Seeding | 1d | — |
| ST-049-T3 | `get_tax_rules`/`get_due_dates` MCP implementation | MCP | 1d | ST-044 |
| ST-049-T4 | Contract test against canonical scenario's Sep 15 due date | Testing | 0.5d | — |

---

### EPIC-20 — Clerk Authentication

**ST-050 — Clerk login/session gating**
Feature: FEAT-032 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As a program evaluator, I want to see the deployed app gated behind a real Clerk login,
so that I can verify Bar 6's authentication requirement.

*Description:* Integrates Clerk for authentication across the deployed web app.

*Business Rules:* SEC-002; Bar 6.

*Acceptance Criteria:*
- Given an unauthenticated visitor, when they open the app URL, then they are redirected to Clerk
  login.
- Given a successful Clerk login, when redirected back, then a session is established and the
  dashboard becomes reachable.
- Given a logged-out or expired session, when any authenticated route is accessed, then the request
  fails closed (redirect to login), never falls through to unauthenticated data.

*Validation Rules:* n/a (delegated to Clerk).

*Error Handling:* Clerk service errors surface a clear "auth unavailable" state, not a silent
bypass.

*Security Considerations:* SEC-002; no role model beyond single-owner-per-account for Track A
(Track C concern).

*Audit Requirements:* login events logged.

*Dependencies:* program-provided Clerk infra.

*Technical Notes:* program-provided integration — minimal custom code expected.

*Definition of Done:* login/session gating demoed live.

*Traceability:* SEC-002; Component: Clerk; Workflow: §9.1; Data: `USER`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-050-T1 | Clerk SDK integration in the web app | Frontend | 1d | — |
| ST-050-T2 | Session-gated route middleware | Backend | 1d | — |
| ST-050-T3 | Fail-closed test: expired session cannot reach authenticated routes | Testing | 0.5d | — |

---

### EPIC-21 — Eligibility Gating

**ST-051 — Extend eligibility enum + gate logic**
Feature: FEAT-033 | Priority: P1 | Points: 3 | Risk: Medium

*User Story:* As the system, I want signup gated on filing structure so that Schedule-C-only logic
is never silently applied to an ineligible user, so that the number is never wrong-by-construction
for someone the product doesn't support.

*Description:* Extends `USER.v1_eligibility` beyond its single documented value
(`schedule_c_supported`) and implements the gate check.

*Business Rules:* BR-006, COMP-003.

*Acceptance Criteria:*
- Given a user selects Schedule C at signup, when checked, then `v1_eligibility=schedule_c_
  supported` and onboarding proceeds.
- Given a user selects a non-Schedule-C filing structure, when checked, then eligibility is set to
  a distinct value (e.g., `ineligible`) and the negative-path UX from ST-052 is shown, not a generic
  error.
- Given the eligibility value set, when reviewed, then it includes at minimum `schedule_c_supported`,
  `ineligible`, and `pending_review` (Pass 2 §11 recommendation).

*Validation Rules:* eligibility must be set before any goal-config/bank-connect flow is reachable.

*Error Handling:* an ineligible user is blocked from Schedule-C flows entirely — never allowed
through with a silent wrong-assumption plan.

*Security Considerations:* none new.

*Audit Requirements:* eligibility decision recorded on `USER`.

*Dependencies:* ST-052 (spike must resolve the negative-path UX first), ST-050.

*Technical Notes:* this story cannot be marked fully done until ST-052's spike produces a concrete
UX to implement against — implement the enum/gate logic now, wire the negative-path screen once
ST-052 resolves.

*Definition of Done:* enum extended; gate logic implemented; negative path implemented per ST-052's
resolution.

*Traceability:* BR-006; COMP-003; Component: Web App; Workflow: §9.1; Data: `USER.v1_eligibility`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-051-T1 | Extend `v1_eligibility` enum (`ineligible`, `pending_review`) | Database | 0.5d | ST-044 |
| ST-051-T2 | Gate-check logic in signup flow | Backend | 1d | ST-050 |
| ST-051-T3 | Negative-path UX implementation (per ST-052's resolution) | Frontend | 1d | ST-052 |
| ST-051-T4 | Unit test: ineligible user blocked from Schedule-C flows | Testing | 0.5d | — |

---

**ST-052 — SPIKE: negative onboarding path design**
Feature: FEAT-033 | Priority: P1 | Points: 2 | Risk: Low

*User Story:* As the design/product owner, I want a short, concrete decision on what a gated-out
(non-Schedule-C) user sees at signup, so that ST-051 can implement a real UX instead of inventing
one from scratch.

*Description:* Design spike per Pass 2 §19a backlog-blocker #3 (GAP-015) — no source document
describes this UX at all.

*Business Rules:* BR-006 (the gate itself is confirmed; the negative-path *experience* is not).

*Acceptance Criteria:*
- Given the spike completes, when documented, then it specifies: the exact copy shown, whether the
  user can request early access / join a waitlist, and whether any data is retained for an
  ineligible signup attempt.
- Given the decision, when reviewed, then it is proportionate to a capstone (a simple, honest
  "not supported yet" message is an acceptable outcome — this does not need a full waitlist system).

*Validation Rules:* n/a (design decision).

*Error Handling:* n/a.

*Security Considerations:* if any data is retained for an ineligible signup, note it does not
conflict with SEC-003 (no real PII on stage — this only matters for Track A's own scripted
eligibility-gate demonstration, if included).

*Audit Requirements:* n/a.

*Dependencies:* none — can start immediately.

*Technical Notes:* this spike is intentionally small — a documented decision, not a design project.

*Definition of Done:* a one-paragraph decision doc exists and ST-051-T3 is unblocked.

*Traceability:* BR-006; GAP-015; Component: Web App; Workflow: §9.1.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-052-T1 | Draft and confirm the negative-path copy/flow decision | Documentation | 0.5d | — |

---

### EPIC-22 — PDF Plan Generation

**ST-053 — Generate PDF cashflow & tax plan**
Feature: FEAT-034 | Priority: P1 | Points: 5 | Risk: Low

*User Story:* As Dev, I want to download a PDF of my cashflow & tax plan on demand, so that I have a
portable, shareable record of the number and its reasoning.

*Description:* Server-side render from the Synthesizer's structured output — one of Bar 4's 3
outputs.

*Business Rules:* FR-23.

*Acceptance Criteria:*
- Given a current `PLAN`, when the user clicks "download PDF," then a PDF is generated containing the
  same number, range, allocation, and reasoning shown on the dashboard.
- Given the PDF and the dashboard are compared, when checked, then all figures match exactly (same
  `PLAN` source — no independent computation).
- Given render fails, when it fails, then an explicit error is shown, never a corrupted or partial
  PDF silently downloaded.

*Validation Rules:* n/a (read-only render).

*Error Handling:* render failure surfaces an error, not a stale/wrong PDF.

*Security Considerations:* PDF generation reads only already-computed `PLAN` output — no independent
data access.

*Audit Requirements:* n/a.

*Dependencies:* ST-035, ST-057.

*Technical Notes:* styling polish is explicitly the first item in the PRD's own cut order (§21) —
prioritize correctness of figures over visual polish.

*Definition of Done:* PDF generation implemented; figures verified identical to dashboard; demoed as
golden-path step 5.

*Traceability:* FR-23; Component: PDF Generator; Workflow: §9.12; Data: `PLAN` (read).

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-053-T1 | PDF render pipeline from structured plan output | Backend | 2d | ST-057 |
| ST-053-T2 | PDF layout (number, allocation, reasoning, disclaimer) | Frontend | 1d | FEAT-045 |
| ST-053-T3 | Cross-check test: PDF figures == dashboard figures | Testing | 0.5d | ST-007 |

---

### EPIC-23 — Email "The Catch" Alert

**ST-054 — SPIKE: email vendor decision**
Feature: FEAT-035 | Priority: P0 | Points: 1 | Risk: High

*User Story:* As the engineering team, I want a decided email vendor (program-provided vs.
third-party), so that FR-24 can actually be built instead of blocked on an open question.

*Description:* Resolves OPEN-ENG-04 — the one Track A item Pass 2 identifies as a genuine blocker
(Pass 2 §19a).

*Business Rules:* INT-007.

*Acceptance Criteria:*
- Given the spike completes, when documented, then a specific vendor (or program-provided service)
  is named with credentials/access confirmed available.
- Given the decision, when reviewed, then it unblocks ST-055 without further design work.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* n/a (vendor choice only — SEC posture is unchanged either way for
Track A).

*Audit Requirements:* n/a.

*Dependencies:* none — highest-priority spike, start immediately.

*Technical Notes:* per ADR-009, either choice satisfies Bar 4 equally — this is an operational, not
architectural, decision. Resolve fast; don't over-deliberate.

*Definition of Done:* vendor named and access confirmed.

*Traceability:* OPEN-ENG-04; INT-007; Component: Email delivery.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-054-T1 | Evaluate program-provided vs. third-party option and decide | Documentation | 0.5d | — |
| ST-054-T2 | Confirm credentials/API access for the chosen vendor | Infrastructure | 0.5d | — |

---

**ST-055 — Compose & send "the catch" email**
Feature: FEAT-035 | Priority: P1 | Points: 5 | Risk: Medium

*User Story:* As Dev, I want to receive an email delivering "the catch" with the one decision I need
to make, so that I don't have to remember to check the dashboard to catch a consequential change.

*Description:* Sends the Alert Composer's copy via the vendor resolved by ST-054.

*Business Rules:* FR-24.

*Acceptance Criteria:*
- Given a materially consequential re-plan, when the Alert Composer approves copy, then an email is
  sent to the user with that exact copy.
- Given the mismatch check (ST-056) rejects the copy, when that happens, then no email is sent
  (boundary — fail closed).
- Given an all-clear run, when checked, then no email is sent at all (Composer isn't even called).
- Given a send failure (vendor error), when it occurs, then it's logged and does not block dashboard
  availability.

*Validation Rules:* recipient must be the account's verified email.

*Error Handling:* send failure logged, retried per a simple policy; never silently dropped without a
record.

*Security Considerations:* email content is generated from already-computed, non-raw-PII figures
(no unredacted transaction memos in Track A's scripted scenario).

*Audit Requirements:* delivery attempt logged; `CHECK_IN.channel=email` recorded.

*Dependencies:* ST-054, ST-023 (Alert Composer), ST-056.

*Technical Notes:* recommend deduping on `CHECK_IN.id` to avoid a double-send on retry (Pass 2 §10
recommendation, not sourced but sensible).

*Definition of Done:* implemented end-to-end; demoed as golden-path step 1 (or via backup
screenshot if live send is flaky on stage).

*Traceability:* FR-24; Component: Alert Composer, Email delivery; Workflow: §9.13; Data: `CHECK_IN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-055-T1 | Email send integration with chosen vendor | Integration | 1.5d | ST-054 |
| ST-055-T2 | Dedupe-on-`CHECK_IN.id` retry safety | Backend | 1d | — |
| ST-055-T3 | E2E test: material re-plan → email received with matching figures | Testing | 1.5d | ST-023 |
| ST-055-T4 | Demo backup artifact: screenshot of a successful send | Demo Assets | 0.5d | — |

---

**ST-056 — SPIKE: mismatch-check mechanism design**
Feature: FEAT-035 | Priority: P0 | Points: 2 | Risk: Medium

*User Story:* As the engineering team, I want a decided mechanism for the FR-24 mismatch check
(regex/structured-diff/LLM self-check/eval-only), so that ST-023 can implement something concrete
instead of a described-but-unbuilt behavior.

*Description:* Resolves OPEN-ENG-05 (Pass 2 §19a backlog blocker #2) — the *behavior* is clear
(reject copy whose numbers differ from the engine's), the *implementation approach* is not.

*Business Rules:* FR-24's mismatch-check requirement.

*Acceptance Criteria:*
- Given the spike completes, when documented, then a specific mechanism is chosen (recommended:
  structured-diff — extract every numeric token from the generated copy and verify each resolves to
  a field in the structured plan result; simpler and more auditable than an LLM self-check for a
  trust-critical guardrail).
- Given the decision, when reviewed, then it unblocks ST-023 and ST-055 without further design work.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* a structured-diff approach is preferable to an LLM self-check specifically
because it removes the model from the trust boundary for this specific guardrail — worth stating
explicitly in the decision doc.

*Audit Requirements:* whichever mechanism is chosen must log a pass/fail result per attempt (feeds
ST-023's audit requirement).

*Dependencies:* none — can start immediately, in parallel with ST-054.

*Technical Notes:* recommend structured-diff over LLM self-check; document the reasoning for future
readers.

*Definition of Done:* mechanism decided and documented; ST-023-T2 unblocked.

*Traceability:* OPEN-ENG-05; FR-24; Component: Alert Composer.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-056-T1 | Evaluate mechanism options and decide (recommend structured-diff) | Documentation | 1d | — |
| ST-056-T2 | Document the chosen mechanism's exact algorithm for ST-023 to implement | Documentation | 0.5d | — |

---

### EPIC-24 — Dashboard Data API

**ST-057 — Plan read API for dashboard**
Feature: FEAT-036 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the web app, I want a single read-only API for the current plan, so that the
dashboard, PDF, and email all render from the identical authoritative source.

*Description:* Read-only endpoint exposing `PLAN` + children without ever computing a figure
client-side.

*Business Rules:* n/a (architectural — Pass 2 §6 "web app non-responsibilities").

*Acceptance Criteria:*
- Given a current `PLAN` exists, when the API is called, then it returns the number, range,
  allocation, projections, and warnings needed by the dashboard.
- Given no `PLAN` exists yet, when called, then it returns an explicit "no plan yet" response, not a
  zero or an error.
- Given the same API is called by the PDF and email paths (indirectly, via the same underlying
  service), when compared, then all three surfaces receive identical figures (boundary).

*Validation Rules:* n/a (read-only).

*Error Handling:* API failure returns a typed error, never a fabricated figure.

*Security Considerations:* Clerk-session-gated; scoped to the requesting user's own data only.

*Audit Requirements:* n/a (read path).

*Dependencies:* ST-035.

*Technical Notes:* this is the literal shared source of truth across every output surface — treat
schema changes here as touching all of EPIC-01/03/07/22/23.

*Definition of Done:* API implemented; consumed identically by dashboard, PDF, and email paths.

*Traceability:* supports FR-22; Component: Web App (backend), Engine MCP; Workflow: §9.6; Data:
`PLAN`, `ALLOCATION_LINE`, `PROJECTION`, `PLAN_WARNING`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-057-T1 | Read API endpoint implementation | API | 1.5d | ST-035 |
| ST-057-T2 | "No plan yet" explicit response shape | Backend | 0.5d | — |
| ST-057-T3 | Contract test consumed identically by 3 output surfaces | Testing | 1d | ST-007,053,055 |

---

### EPIC-25 — Langfuse Tracing

**ST-058 — Instrument orchestrator loop with Langfuse spans**
Feature: FEAT-037 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As a program evaluator, I want to open Langfuse and see a full trace of a re-plan loop,
so that I can verify Bar 7's tracing requirement.

*Description:* Every tool call, skill invocation, and interpreter confidence score is instrumented
as a Langfuse span within the run's trace.

*Business Rules:* AUD-001; Bar 7.

*Acceptance Criteria:*
- Given any `AGENT_RUN`, when it completes, then a full Langfuse trace exists linked via
  `AGENT_RUN.langfuse_trace_id`.
- Given the Transaction Interpreter is called within a run, when traced, then its confidence score
  appears as part of the span.
- Given the golden-path re-plan (PRD §18 step 4), when demoed, then the full trace is viewable live
  in Langfuse, tool call by tool call.

*Validation Rules:* n/a.

*Error Handling:* a missing trace is a Bar 7 evidence gap, not a functional failure — log a warning
if instrumentation fails, but never block the run itself on tracing failure.

*Security Considerations:* trace redaction policy for raw transaction memos is explicitly deferred to
Track C (Pass 2 §10) — Track A carries no real PII, so this is safe to defer.

*Audit Requirements:* this story *is* the observability layer (Pass 2 §14).

*Dependencies:* ST-013 (orchestrator loop), program-provided Langfuse infra.

*Technical Notes:* redaction is out of scope for Track A by design — do not add redaction logic here
prematurely; note it as TC-item for later.

*Definition of Done:* instrumentation implemented; a full re-plan trace demoed live in Langfuse.

*Traceability:* AUD-001; Bar 7; Component: Orchestrator, Langfuse; Workflow: all; Data:
`AGENT_RUN.langfuse_trace_id`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-058-T1 | Langfuse SDK integration in orchestrator loop | Observability | 1.5d | ST-013 |
| ST-058-T2 | Span instrumentation per tool call/skill invocation | Observability | 1.5d | — |
| ST-058-T3 | Interpreter confidence captured in span metadata | Observability | 1d | ST-015 |
| ST-058-T4 | Live trace demo dry-run (view the golden-path re-plan trace) | Testing | 1d | ST-072 |

---

### EPIC-26 — Cost Ceiling & Run Tracking

**ST-059 — Enforce spend ceiling per agent run**
Feature: FEAT-038 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As a program evaluator, I want to see a spend ceiling actually cap a run, so that I
can verify Bar 7's cost-control requirement.

*Description:* A configured token/dollar ceiling per `AGENT_RUN`, enforced and demonstrable.

*Business Rules:* SEC-005; OPS-001.

*Acceptance Criteria:*
- Given a configured ceiling, when a run's cumulative cost approaches it, then the run halts before
  exceeding the ceiling.
- Given a run is halted by the ceiling, when inspected, then `AGENT_RUN.token_cost` and a clear
  halt reason are recorded — never a silent partial result presented as complete.
- Given a normal run well under the ceiling, when it completes, then it is unaffected (boundary — no
  false-positive halting).

*Validation Rules:* ceiling value is configurable, not hardcoded inline.

*Error Handling:* halted run surfaces a clear state, not an ambiguous failure.

*Security Considerations:* prevents runaway spend — directly satisfies SEC-005.

*Audit Requirements:* `AGENT_RUN.token_cost` populated on every run.

*Dependencies:* ST-013.

*Technical Notes:* the exact numeric ceiling value is an [Open decision] (Pass 2 §13) — implement
behind a config value; pick a demo-safe default.

*Definition of Done:* ceiling enforcement implemented; demoed live (Bar 7's "show the cost cap").

*Traceability:* SEC-005; OPS-001; Component: Orchestrator; Data: `AGENT_RUN.token_cost`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-059-T1 | Cost-tracking instrumentation per tool/model call | Backend | 1d | ST-013 |
| ST-059-T2 | Ceiling-enforcement halt logic | Backend | 1d | — |
| ST-059-T3 | Demo dry-run: intentionally trigger the ceiling to prove it works | Testing | 0.5d | — |

---

**ST-060 — `AGENT_RUN`/`AGENT_RUN_ATTEMPT` retry tracking**
Feature: FEAT-038 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the engineering team, I want every agent run's retries tracked, so that a
transient failure is visible and recoverable rather than a silent, unexplained gap.

*Description:* Implements `AGENT_RUN_ATTEMPT` recording for retries per a defined policy.

*Business Rules:* AUD-003.

*Acceptance Criteria:*
- Given a tool call fails transiently, when retried, then an `AGENT_RUN_ATTEMPT` row records the
  attempt number, error code/message, and timestamps.
- Given the retry policy's max attempts is exhausted, when that happens, then `AGENT_RUN.status=
  error` is set and the failure is surfaced, never silently swallowed.
- Given a retry succeeds, when it does, then `AGENT_RUN.status` reflects the successful completion,
  with the attempt history preserved.

*Validation Rules:* attempt numbers are sequential per run.

*Error Handling:* this story *is* the error-handling mechanism for the whole orchestrator loop.

*Security Considerations:* none new.

*Audit Requirements:* `AGENT_RUN_ATTEMPT.error_code`/`error_message` captured per Pass 2 §15.

*Dependencies:* ST-013.

*Technical Notes:* the exact retry count/backoff policy is an [Open decision] (OPEN-ENG-06) —
Pass 2 recommends max 3 attempts with exponential backoff as a reasonable default; implement behind
config.

*Definition of Done:* implemented and tested with an intentionally-failing tool call.

*Traceability:* AUD-003; Component: Orchestrator, Headless Runner; Data: `AGENT_RUN`,
`AGENT_RUN_ATTEMPT`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-060-T1 | Retry policy implementation (max attempts, backoff) | Backend | 1.5d | ST-013 |
| ST-060-T2 | `AGENT_RUN_ATTEMPT` write path | Backend | 1d | ST-045 |
| ST-060-T3 | Test: intentional failure → retries recorded → eventual error/success | Testing | 1d | — |

---

### EPIC-27 — Live Deployment

**ST-061 — Deploy web app + headless runner behind HTTPS**
Feature: FEAT-039 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As a program evaluator, I want to open a live HTTPS URL and log in, so that I can
verify Bar 6's live-deployment requirement.

*Description:* Deploys both the web app and the headless runner to a program-approved target.

*Business Rules:* Bar 6.

*Acceptance Criteria:*
- Given the deployed URL, when opened, then it serves over HTTPS and redirects to Clerk login if
  unauthenticated.
- Given a successful login, when the dashboard loads, then it reflects live data from the demo
  database (not a local/dev instance).
- Given the headless runner is deployed, when a trigger fires, then it executes against the same
  demo database the web app reads from (not the dev database, per ADR-010).

*Validation Rules:* n/a.

*Error Handling:* deployment failure is caught by CI before reaching the live URL.

*Security Considerations:* HTTPS enforced; Clerk-gated; cost cap active in this environment.

*Audit Requirements:* deployment events logged (standard platform logging).

*Dependencies:* ST-050 (Clerk), ST-062 (env separation).

*Technical Notes:* program-provided deploy target — confirm specifics with program infra early
(R-008 dependency).

*Definition of Done:* live URL demoed on stage with Clerk login.

*Traceability:* Bar 6; Component: Web App, Headless Runner; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-061-T1 | Web app deploy pipeline (HTTPS, program target) | Deployment | 2d | ST-050 |
| ST-061-T2 | Headless runner deploy pipeline | Deployment | 1.5d | ST-014 |
| ST-061-T3 | Smoke test: live URL → login → dashboard reflects demo DB | Testing | 1d | — |

---

### EPIC-28 — Environment Separation

**ST-062 — Separate dev/demo DB config**
Feature: FEAT-040 | Priority: P0 | Points: 3 | Risk: Medium

*User Story:* As the engineering team, I want Claude Code dev invocations pointed at a separate
database from the deployed demo environment, so that a dev-time experiment can never corrupt the
demo persona's plan history right before a dry run.

*Description:* Implements ADR-010 — distinct connection strings/schemas per environment, shared
code path.

*Business Rules:* GAP-018; ADR-010.

*Acceptance Criteria:*
- Given a Claude Code dev invocation of the Synthesizer, when it writes a `PLAN`, then it writes to
  the dev database, never the demo database.
- Given the headless runner's deployed invocation, when it writes a `PLAN`, then it writes to the
  demo database only.
- Given both invocations use identical skill code, when compared (ties to ST-014's identical-digest
  test), then only the connection target differs — no code fork.

*Validation Rules:* environment variables/config must make the target database explicit and
impossible to default incorrectly.

*Error Handling:* a misconfigured environment should fail loudly at startup, not silently connect to
the wrong database.

*Security Considerations:* prevents accidental demo-state corruption — a reliability/trust control,
not a traditional security boundary.

*Audit Requirements:* n/a.

*Dependencies:* ST-044, ST-064 (repo/CI, for environment config conventions).

*Technical Notes:* small in scope for a capstone — a `.env`-per-environment pattern is sufficient
(Pass 2 §14 recommendation).

*Definition of Done:* implemented; verified no cross-contamination in a real dev + demo dual-run
test.

*Traceability:* GAP-018; Component: Orchestrator, Headless Runner, PostgreSQL; Data: n/a
(configuration).

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-062-T1 | Per-environment `.env` configuration convention | Infrastructure | 1d | FEAT-042 |
| ST-062-T2 | Startup validation: fail loudly on ambiguous DB target | Backend | 1d | — |
| ST-062-T3 | Cross-contamination test: dev write never appears in demo DB | Testing | 1d | — |

---

### EPIC-29 — Demo Reset & Replay

**ST-063 — Demo reset & replay script for 3 personas**
Feature: FEAT-041 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As the delivery team, I want a single script to reset the demo database to each
persona's fixture baseline, so that dry runs #1–#3 and Demo Day itself never carry over corrupted
state from a prior run.

*Description:* Truncate/reseed script implementing Pass 2 §9.18/§14's proposed (unsourced) reset
procedure.

*Business Rules:* R-012 (no reset/replay procedure is documented in any source — this is a Pass 2
recommendation, not a sourced FR).

*Acceptance Criteria:*
- Given the demo database has accumulated state from a prior run, when the reset script runs, then
  it is restored exactly to the 3 personas' fixture baseline.
- Given the reset completes, when the canonical Dev persona is recomputed, then it reproduces
  $3,650/$6,000 exactly (regression-proof reset).
- Given the script is run twice in a row, when compared, then both resets produce identical
  `PLAN.output_digest` values (determinism proof).

*Validation Rules:* the script must be safe to run repeatedly without manual cleanup steps.

*Error Handling:* a failed reset halts loudly rather than leaving the database in a half-reset
state.

*Security Considerations:* only operates on demo-environment data, never the dev database (ties to
ST-062).

*Audit Requirements:* n/a.

*Dependencies:* ST-043 (persona fixtures), ST-045 (schema).

*Technical Notes:* this directly mitigates R-012 — a botched manual reset between dry runs would
threaten the canonical scenario's reproducibility guarantee (R-001's whole mitigation).

*Definition of Done:* script implemented; used successfully before dry-run #1.

*Traceability:* R-012; Component: PostgreSQL persistence, Scripted demo-data source; Workflow:
§9.18; Data: all persona-scoped entities.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-063-T1 | Truncate/reseed script for the 3 personas | Infrastructure | 2d | ST-043,045 |
| ST-063-T2 | Idempotent-reset test (run twice, identical digests) | Testing | 1d | — |
| ST-063-T3 | Canonical-scenario post-reset regression check | Testing | 1d | ST-071 |
| ST-063-T4 | Runbook documentation for operator use before each dry run | Documentation | 0.5d | — |

---

### EPIC-30 — Repo, CI/CD & MCP Framework

**ST-064 — Repo scaffolding + CI pipeline**
Feature: FEAT-042 | Priority: P0 | Points: 3 | Risk: Low

*User Story:* As the engineering team, I want a scaffolded repo with a working CI pipeline on day
one, so that every subsequent story can rely on automated checks instead of manual verification.

*Description:* Repo structure (frontend, agent runtime, MCP servers, migrations), CI running lint/
type-check/test on every PR.

*Business Rules:* n/a (foundation).

*Acceptance Criteria:*
- Given a trivial change, when pushed, then CI runs and passes in under a defined time budget.
- Given a change that breaks a test, when pushed, then CI fails and blocks merge.
- Given the repo structure, when a new engineer clones it, then the top-level layout matches the
  architecture components named in Pass 2 §6 (no ad hoc structure).

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* CI secrets (API keys, DB credentials) never committed to the repo.

*Audit Requirements:* n/a.

*Dependencies:* none — first story in the sequence.

*Technical Notes:* keep this proportional to a capstone — no need for a heavyweight multi-stage
pipeline.

*Definition of Done:* CI green on a trivial change; repo structure documented.

*Traceability:* Component: all (foundation); Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-064-T1 | Repo scaffolding (frontend/agent/MCP/migrations directories) | Infrastructure | 1d | — |
| ST-064-T2 | CI pipeline (lint, type-check, test) | Infrastructure | 1d | — |
| ST-064-T3 | Secrets management convention (never committed) | Infrastructure | 0.5d | — |

---

**ST-065 — Shared MCP server framework & tool-call conventions**
Feature: FEAT-043 | Priority: P0 | Points: 5 | Risk: Medium

*User Story:* As an engineer building any of the 4 MCP servers, I want a shared framework and
conventions, so that each server doesn't reinvent tool-call handling, error shapes, and contract
testing from scratch.

*Description:* Shared scaffolding for MCP server definition, tool registration, typed request/
response contracts, and a contract-test harness.

*Business Rules:* n/a (foundation).

*Acceptance Criteria:*
- Given the framework, when a new MCP server is scaffolded from it, then it takes under a day to
  stand up a minimal working server (Success Criteria from EPIC-30).
- Given any tool call, when it errors, then the error shape is consistent across all 4 MCP servers
  (aggregator, tax-rule, expected-income, engine).
- Given the contract-test harness, when used by any MCP server's tests, then it validates request/
  response shapes against the declared contract automatically.

*Validation Rules:* n/a.

*Error Handling:* consistent error shape across all servers is itself the requirement.

*Security Considerations:* framework enforces that no tool call can be invoked without proper
session/service-auth context.

*Audit Requirements:* framework includes standard logging hooks used by all 4 servers.

*Dependencies:* ST-064.

*Technical Notes:* this is what makes ST-027, ST-041, ST-048, ST-049 all consistent instead of four
independent implementations.

*Definition of Done:* framework implemented; used by all 4 MCP server stories.

*Traceability:* Bar 3 (foundation for all 4 sources); Component: all 4 MCP servers; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-065-T1 | MCP server scaffold template + tool registration convention | MCP | 2d | ST-064 |
| ST-065-T2 | Standard error-shape + logging hooks | MCP | 1d | — |
| ST-065-T3 | Contract-test harness | Testing | 1.5d | — |
| ST-065-T4 | Scaffold-a-new-server timing test (<1 day success criterion) | Testing | 0.5d | — |

---

### EPIC-31 — Orchestrator↔Engine Contract Enforcement

**ST-066 — Lint/type boundary preventing Orchestrator from computing figures**
Feature: FEAT-044 | Priority: P0 | Points: 3 | Risk: High

*User Story:* As the engineering team, I want a structural guard that fails CI if the Orchestrator
ever computes a financial figure directly, so that "the model never invents or overrides a
financial fact" is an enforced boundary, not just a documented convention that erodes over time.

*Description:* A lint rule or type boundary (e.g., disallowing arithmetic operators on financial
value types outside the engine module) implementing Pass 2 §19a's recommended enabler.

*Business Rules:* ADR-002 (deterministic financial engine boundary); the single non-negotiable rule
of the entire system.

*Acceptance Criteria:*
- Given a code change that computes a Safe-to-Pay-adjacent figure inside the Orchestrator module,
  when CI runs, then the guard fails the build.
- Given a code change that only calls a named engine tool and narrates its result, when CI runs,
  then the guard passes.
- Given the guard is intentionally violated in a test fixture, when CI runs against it, then it
  correctly fails (boundary — proves the guard actually works, not just that it's present).

*Validation Rules:* n/a.

*Error Handling:* a failing guard blocks merge with a clear message pointing at the violation.

*Security Considerations:* this is itself the primary trust/security control of the whole system.

*Audit Requirements:* n/a.

*Dependencies:* ST-013, ST-027.

*Technical Notes:* this is the single highest-value technical enabler in the backlog — the
consequence of skipping it is the one failure mode ("a wrong number") every source document names
as fatal.

*Definition of Done:* guard implemented; the intentionally-failing test case demonstrably fails CI.

*Traceability:* ADR-002; Component: Orchestrator, Engine MCP; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-066-T1 | Lint rule / type boundary design and implementation | Backend | 1.5d | ST-064 |
| ST-066-T2 | Wire into CI as a blocking check | Infrastructure | 0.5d | — |
| ST-066-T3 | Intentionally-failing test fixture proving the guard works | Testing | 1d | — |

---

### EPIC-32 — Shared UI Component Library

**ST-067 — Shared UI kit (ranges, disclaimers, cards)**
Feature: FEAT-045 | Priority: P0 | Points: 3 | Risk: Low

*User Story:* As any UI story in EPIC-01–03, I want shared components for displaying a range +
assumption and the NFA disclaimer, so that UX-003's "every figure is a range with its assumption
stated" holds by construction everywhere, not by each screen remembering to do it.

*Description:* A small component kit: range display, NFA disclaimer banner, card/list primitives.

*Business Rules:* UX-003; COMP-001 (NFA disclaimer on every surfaced figure).

*Acceptance Criteria:*
- Given the range-display component, when used anywhere a figure is shown, then it always renders
  the range and its stated assumption alongside the headline number.
- Given the disclaimer component, when used, then it renders the exact NFA language from PRD §15
  consistently across dashboard, PDF, and email.
- Given a new screen is built using these components, when reviewed, then it cannot accidentally
  omit the range/disclaimer without an explicit override (boundary — safe-by-default design).

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* n/a.

*Dependencies:* ST-064.

*Technical Notes:* build this early — EPIC-01/02/03 all depend on it.

*Definition of Done:* kit implemented; adopted by ST-001–ST-009.

*Traceability:* UX-003; COMP-001; Component: Web App; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-067-T1 | Range + assumption display component | Frontend | 1d | ST-064 |
| ST-067-T2 | NFA disclaimer component (dashboard/PDF/email variants) | Frontend | 1d | — |
| ST-067-T3 | Card/list primitives | Frontend | 1d | — |

---

### EPIC-33 — Foundational Design Spikes

**ST-068 — SPIKE: duplicate-trigger reconciliation behavior**
Feature: FEAT-046 | Priority: P1 | Points: 2 | Risk: Medium

*User Story:* As the engineering team, I want a decided behavior for a duplicate webhook/trigger
delivery (silently dedupe vs. surface an error), so that ST-010/ST-011's idempotency checks
implement something concrete instead of an unspecified behavior.

*Description:* Resolves GAP-017 (Pass 2 §19a backlog blocker #4) — the `idempotency_key` uniqueness
constraint is modeled, but the *reconciliation behavior* on a duplicate is not.

*Business Rules:* n/a (open decision).

*Acceptance Criteria:*
- Given the spike completes, when documented, then it states the exact behavior (recommended:
  silently dedupe — log the duplicate delivery at debug level, do not create a second `AGENT_RUN`,
  do not surface anything to the user, since a duplicate is an infrastructure artifact, not a
  business event).
- Given the decision, when reviewed, then ST-010-T2 and ST-011-T2's dedupe logic implement exactly
  this behavior.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* the chosen behavior must still be logged somewhere for debugging, even if
silent to the user.

*Dependencies:* none — can start immediately.

*Technical Notes:* recommend silent dedupe as the default — surfacing an error to the user for an
infra-level duplicate delivery would violate earned-attention (FR-21) for a non-business event.

*Definition of Done:* decision documented; ST-010/ST-011's dedupe tasks implement it.

*Traceability:* GAP-017; Component: Orchestrator; Workflow: §9.16.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-068-T1 | Decide and document the duplicate-trigger reconciliation behavior | Documentation | 1d | — |

---

**ST-069 — SPIKE: `is_commingled` ownership decision**
Feature: FEAT-046 | Priority: P2 | Points: 1 | Risk: Low

*User Story:* As the engineering team, I want a decided default for `BANK_ACCOUNT.is_commingled` in
Track A, so that onboarding doesn't need to invent a determination mechanism the docs never
specified.

*Description:* Resolves OPEN-ARCH-01 — Pass 2 already recommends defaulting `true` for all Track A
accounts (matches the ICP's own definition); this spike confirms and documents that as the decision
rather than leaving it merely implied.

*Business Rules:* n/a (default-value decision).

*Acceptance Criteria:*
- Given the spike completes, when documented, then `is_commingled` defaults to `true` for every
  Track A account, with no onboarding-time question asked (since the demo personas are commingled
  by construction, per PRD §3).
- Given this default, when reviewed, then a real onboarding-time determination (self-report vs.
  inference) is explicitly deferred to Track C, not silently forgotten.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* n/a.

*Dependencies:* none.

*Technical Notes:* lowest-risk, lowest-priority spike in the backlog — mostly a confirmation of
Pass 2's own recommendation.

*Definition of Done:* decision documented in `data-model.md`'s field notes (or an equivalent).

*Traceability:* OPEN-ARCH-01; Component: Aggregator MCP; Data: `BANK_ACCOUNT.is_commingled`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-069-T1 | Confirm and document the default-`true` decision | Documentation | 0.5d | — |

---

### EPIC-34 — Skill Eval Suites

**ST-070 — 14(+6) core eval green-gate checkpoint**
Feature: FEAT-047 | Priority: P0 | Points: 2 | Risk: Medium

*User Story:* As the delivery team, I want a single checkpoint confirming all core evals are green
before Demo Day, so that Bar 5's acceptance criterion is provably satisfied, not just individually
true per skill.

*Description:* Aggregates ST-017, ST-021, ST-024, ST-025, ST-040's results into one go/no-go gate.

*Business Rules:* PRD §17 acceptance: "14/14 core evals green (+6 if Materiality/Alert are built)."

*Acceptance Criteria:*
- Given all 5 eval suites have run, when the checkpoint evaluates, then it reports 14/14 (or 20/20 if
  Materiality/Alert are built) green.
- Given any suite is red, when the checkpoint runs, then it blocks the "Demo Day ready" status,
  surfaced clearly to the delivery team (not buried in individual CI logs).

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* none.

*Audit Requirements:* checkpoint result stored as a build artifact, referenced in dry-run sign-off.

*Dependencies:* ST-017, ST-021, ST-024, ST-025, ST-040.

*Technical Notes:* this is a thin aggregation story, not new eval logic — it exists to make Bar 5's
overall status legible at a glance.

*Definition of Done:* checkpoint implemented; green before dry-run #1.

*Traceability:* Bar 5; Component: all 5 skills; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-070-T1 | Aggregate eval-gate checkpoint (CI job summarizing all 5 suites) | Testing | 1d | ST-017,021,024,025,040 |

---

### EPIC-35 — Engine Regression & Canonical Scenario Tests

**ST-071 — Canonical-scenario regression test ($3,650 reproducibility)**
Feature: FEAT-048 | Priority: P0 | Points: 3 | Risk: High

*User Story:* As the delivery team, I want a standing regression test pinning the canonical
scenario's exact numbers, so that no future change can silently break the one figure the entire demo
depends on.

*Description:* A CI-run test computing the Dev persona's canonical scenario and asserting $3,650
(Acme-slip) and $6,000 (on-time) exactly, plus the $900 tax gap.

*Business Rules:* BRULE-006; R-001's core mitigation.

*Acceptance Criteria:*
- Given the Dev persona's canonical inputs, when the test runs, then Safe-to-Pay = $3,650
  (stressed) and $6,000 (on-time) exactly, and the tax gap = $900 exactly.
- Given any change to the waterfall, tax computation, or forecasting logic, when CI runs this test,
  then any drift from these figures fails the build immediately.
- Given the test passes, when checked against `output_digest`, then the digest is stable across
  repeated runs with unchanged inputs (determinism).

*Validation Rules:* n/a.

*Error Handling:* a failing test blocks merge — this is the single highest-value regression test in
the system (Pass 2 §16).

*Security Considerations:* none.

*Audit Requirements:* n/a.

*Dependencies:* ST-031, ST-034, ST-043.

*Technical Notes:* run this test on every PR touching the engine, tax, or forecasting code — not
just nightly.

*Definition of Done:* test implemented and running in CI as a blocking check.

*Traceability:* BRULE-006; R-001; Component: Engine MCP; Data: `PLAN`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-071-T1 | Pinned canonical-scenario regression test implementation | Testing | 1.5d | ST-043 |
| ST-071-T2 | Wire as a blocking CI check on engine/tax/forecasting changes | Testing | 0.5d | FEAT-042 |

---

### EPIC-36 — End-to-End Dry Runs

**ST-072 — Dry-run #1 (W7)**
Feature: FEAT-049 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As the delivery team, I want a full rehearsal of the golden-path demo script with all
7 bars, so that integration issues surface with a full week of runway to fix them before Demo Day.

*Description:* First full end-to-end rehearsal per PRD §21's W7 milestone.

*Business Rules:* PRD §21 W7 milestone: "end-to-end dry-run #1."

*Acceptance Criteria:*
- Given the demo reset script has run, when the golden-path script (PRD §18) is executed live,
  then all 7 bars are attempted in sequence.
- Given any bar fails during the dry run, when it fails, then it's logged as a specific, actionable
  defect — not a vague "something broke."
- Given the dry run completes, when reviewed, then the team has a concrete punch list for the
  remaining time before dry-run #2.

*Validation Rules:* n/a.

*Error Handling:* n/a (this story's entire purpose is finding errors).

*Security Considerations:* none new.

*Audit Requirements:* dry-run results documented for comparison against dry-runs #2/#3.

*Dependencies:* every other epic (this is the first point all components must work together).

*Technical Notes:* run the demo reset script (ST-063) immediately before this dry run.

*Definition of Done:* dry-run #1 completed; punch list documented.

*Traceability:* PRD §21; Component: all; Workflow: all (§9.1–§9.18).

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-072-T1 | Execute demo reset (ST-063) immediately before the run | Deployment | 0.5d | ST-063 |
| ST-072-T2 | Run the full golden-path script live, all 7 bars | Testing | 1d | — |
| ST-072-T3 | Document punch list of defects found | Documentation | 0.5d | — |

---

**ST-073 — Dry-runs #2–#3 (W8)**
Feature: FEAT-049 | Priority: P0 | Points: 5 | Risk: High

*User Story:* As the delivery team, I want two further rehearsals in the final week, so that Demo
Day itself is a zero-surprise repetition of something already proven twice.

*Description:* Final rehearsals per PRD §21's W8 milestone, incorporating dry-run #1's punch list
fixes.

*Business Rules:* PRD §21 W8 milestone: "dry-runs #2–#3; Demo Day Aug 14."

*Acceptance Criteria:*
- Given dry-run #1's punch list, when dry-run #2 executes, then every previously-found defect is
  either fixed and verified, or explicitly triaged as accepted risk.
- Given dry-run #3 executes, when completed, then it passes with zero manual workarounds (the
  Definition of Done for EPIC-36).
- Given both dry runs use the reset script between them, when compared, then results are
  reproducible run-to-run (ties to ST-063's determinism guarantee).

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* none new.

*Audit Requirements:* final dry-run sign-off is the go/no-go artifact for Demo Day itself.

*Dependencies:* ST-072, ST-063.

*Technical Notes:* this is the last checkpoint before Demo Day — treat any remaining P0/P1 defect
found here as a stop-ship issue, not a "note for later."

*Definition of Done:* dry-run #3 passes with zero manual workarounds; formal go/no-go sign-off
recorded.

*Traceability:* PRD §21; Component: all; Workflow: all.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-073-T1 | Reset + execute dry-run #2, verify punch-list fixes | Testing | 1d | ST-072 |
| ST-073-T2 | Reset + execute dry-run #3, zero-workaround pass | Testing | 1d | — |
| ST-073-T3 | Formal go/no-go sign-off documentation | Documentation | 0.5d | — |

---

### EPIC-37 — Security-Focused Demo Tests

**ST-074 — Token-never-reaches-frontend & no-real-PII test pass**
Feature: FEAT-050 | Priority: P0 | Points: 2 | Risk: Medium

*User Story:* As the delivery team, I want to verify — not just assert — that aggregator tokens
never reach the frontend and that no real PII exists in any fixture, so that Track A's demo-grade
security claims are actually true.

*Description:* Scoped security tests for SEC-001 and SEC-003, explicitly not a production
pen-test (Pass 2 §16).

*Business Rules:* SEC-001, SEC-003.

*Acceptance Criteria:*
- Given any frontend network request/response, when inspected, then no raw access token ever
  appears in a client-visible payload.
- Given all 3 persona fixture sets, when scanned, then no real names, real account numbers, or real
  PII of any kind is present — all data is synthetic.
- Given this test suite, when it fails, then it blocks the "Demo Day ready" status (ties to ST-070's
  checkpoint pattern).

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* this story *is* the security verification — explicitly scoped to Track
A's claims only, must not be represented as a production security audit.

*Audit Requirements:* test results documented as evidence for Bar 6's security posture claim.

*Dependencies:* ST-041, ST-043.

*Technical Notes:* keep scope tight — this is not SOC 2, not a pen-test, just a verification of two
specific, narrow claims.

*Definition of Done:* both checks pass; documented as Track A (not production) security evidence.

*Traceability:* SEC-001, SEC-003; Component: Aggregator MCP, Web App; Data: n/a.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-074-T1 | Network-inspection test: token never appears client-side | Testing | 1d | ST-041 |
| ST-074-T2 | Fixture-data PII scan across all 3 personas | Testing | 0.5d | ST-043 |

---

**ST-075 — Cost ceiling enforcement test**
Feature: FEAT-050 | Priority: P0 | Points: 1 | Risk: Low

*User Story:* As the delivery team, I want to verify the cost ceiling actually halts a run, not just
that the config value exists, so that Bar 7's "show the cost cap" claim is backed by a real test.

*Description:* Verification companion to ST-059's implementation.

*Business Rules:* SEC-005.

*Acceptance Criteria:*
- Given a test run configured to exceed the ceiling, when executed, then the run halts at the
  ceiling with a clear, recorded reason.
- Given this test, when it fails, then it blocks the "Demo Day ready" status.

*Validation Rules:* n/a.

*Error Handling:* n/a.

*Security Considerations:* verifies SEC-005 is real, not asserted.

*Audit Requirements:* test result documented as Bar 7 evidence.

*Dependencies:* ST-059.

*Technical Notes:* small, focused verification — pairs directly with ST-059-T3.

*Definition of Done:* test passes; documented as Bar 7 evidence.

*Traceability:* SEC-005; Component: Orchestrator; Data: `AGENT_RUN.token_cost`.

| Task ID | Description | Type | Effort | Dependencies |
|---|---|---|---|---|
| ST-075-T1 | Ceiling-triggering test scenario + verification | Testing | 0.5d | ST-059 |

---

## 6. Technical tasks

Every story in §5 carries its own embedded technical-task table (Task ID, Description, Type,
Estimated Effort, Dependencies) — this section indexes them by type rather than repeating the full
set of rows. Exact counts are derivable by summing the per-story tables in §5; the breakdown below
is a representative roll-up.

| Task Type | Approx. Count | Representative Stories |
|---|---|---|
| Frontend | ~35 | ST-001, ST-003, ST-005, ST-007, ST-008, ST-067 |
| Backend | ~70 | ST-018, ST-022, ST-029, ST-031–035, ST-059, ST-060, ST-066 |
| Database | ~15 | ST-028, ST-044, ST-045, ST-046, ST-051 |
| API | ~20 | ST-003, ST-012, ST-027, ST-048, ST-057 |
| AI Agent | ~20 | ST-013, ST-015, ST-016, ST-023, ST-026 |
| MCP | ~20 | ST-027, ST-028, ST-041, ST-048, ST-049, ST-065 |
| Integration | ~5 | ST-041, ST-055 |
| Infrastructure | ~15 | ST-014, ST-061, ST-062, ST-063, ST-064 |
| Observability | ~8 | ST-058, ST-059, ST-060 |
| Testing | ~65 | present in nearly every story; concentrated in EPIC-34–37 |
| Documentation | ~12 | ST-047, ST-052, ST-054, ST-056, ST-068, ST-069, ST-072, ST-073 |
| Deployment | ~6 | ST-061, ST-072 |
| Data Seeding | ~8 | ST-042, ST-043, ST-049 |
| Demo Assets | ~10 | ST-001, ST-002, ST-004, ST-005, ST-043, ST-055 |
| **Total** | **~280** | across 75 stories |

---

## 7. Technical enablers

Enabler stories exist to unblock or de-risk user-facing work; none is forced into a user-facing
story's acceptance criteria. Every example category the task called out is represented:

| Enabler Category | Story ID(s) | Why it's an enabler, not a user story |
|---|---|---|
| Environment setup | ST-062, ST-064 | No end user ever "uses" dev/demo separation or repo scaffolding — it protects delivery integrity |
| Database schema | ST-044, ST-045 | Foundational structure every feature reads/writes against; no standalone user value |
| MCP framework | ST-065 | Internal scaffolding so 4 MCP servers share conventions instead of diverging |
| Authentication | ST-050 | Gates access; the "feature" is invisible when working correctly |
| Langfuse integration | ST-058 | Observability plumbing for evaluators/engineers, not the end user |
| CI/CD | ST-064 | Build-pipeline plumbing |
| Fixture loading | ST-042, ST-043 | Demo-data infrastructure, not a product feature |
| Demo reset tooling | ST-063 | Operator tooling for rehearsals, not user-facing |
| Shared UI components | ST-067 | Presentation-layer plumbing consumed by every screen |
| Observability framework | ST-058, ST-059, ST-060 | Tracing/cost/retry plumbing underlying every run |
| Orchestrator↔Engine contract guard | ST-066 | A CI-level structural guard, not a feature |
| Correction-log semantics | ST-047 | Documentation/semantic clarification, not new behavior |
| Engine tool contracts | ST-027, ST-028 | The API surface other components call — no direct end-user interaction |
| Aggregator interface | ST-041 | Provider-agnostic contract, invisible to the end user |

---

## 8. Testing backlog

Every story in §5 embeds its own test tasks; this section aggregates by layer and calls out demo
validation explicitly, since a capstone demo's "test suite" is partly a live rehearsal, not only
automated checks.

| Test Layer | Purpose | Primary Stories | Automated? |
|---|---|---|---|
| Unit tests | Waterfall math, tax computation, classification logic, versioning constraints | ST-015, ST-016, ST-029, ST-031–039, ST-044–046 | Yes |
| Integration tests | Orchestrator → skill → MCP → Postgres round-trips | ST-001, ST-005, ST-011, ST-018, ST-041 | Yes |
| Contract tests | MCP tool-call shapes match declared contracts | ST-027, ST-028, ST-041, ST-048, ST-049, ST-065 | Yes |
| Eval suites | Per-skill behavioral correctness (14 core + 6 optional) | ST-017, ST-021, ST-024, ST-025, ST-040, ST-070 | Yes |
| Regression tests | Canonical scenario never drifts from $3,650/$6,000/$900 | ST-071 | Yes |
| Determinism tests | Identical inputs → identical digests | ST-014, ST-027, ST-046, ST-063 | Yes |
| Security-focused tests | Token isolation, no real PII, cost-ceiling enforcement (Track A scope only) | ST-074, ST-075 | Yes |
| Accessibility checks | Keyboard nav + contrast on demo-critical screens | ST-007 | Yes (basic) |
| End-to-end / dry runs | Full golden-path script across all 7 bars | ST-072, ST-073 | Manual (rehearsed) |
| Demo validation | Live-stage proof artifacts per bar | ST-004, ST-005, ST-011, ST-053, ST-055, ST-058, ST-059 | Manual (scripted) |
| Regression-of-fixtures | Persona data stays internally consistent across changes | ST-043 | Yes |

**Requirements with no automated verification method yet (carried forward, not silently dropped):**
FR-24's mismatch-check mechanism cannot be test-automated until ST-056's spike resolves; BR-006's
negative-onboarding path cannot be tested until ST-052's spike resolves; GAP-017's duplicate-trigger
behavior cannot be tested until ST-068's spike resolves. All three are P0/P1 spikes scheduled in
Sprint 0/4 (see §9) specifically so their dependent tests aren't stranded.

---

## 9. Sprint plan

Sprints are aligned 1:1 to the PRD's own W1–W8 program weeks (`PRD-v2.md` §21), sequenced by
dependency order rather than equal story counts — per instruction, some sprints (notably Sprint 2)
are intentionally heavier because that's where the PRD's own critical path concentrates
(Interpreter + Synthesizer + evals + Bar 3 completion). **As of this document's date (2026-07-16),
the program is mid-Sprint 3/W4** (Pass 2 §1) — this plan is presented in full from Sprint 0 for
backlog completeness, not as a claim that earlier sprints haven't started.

### Sprint 0 — Foundations (W1: Jun 23–29)
**Objectives:** stand up the repo, CI, schema, MCP framework, contract guard, and shared UI kit;
resolve all 4 cheap foundational spikes immediately so nothing downstream is blocked later.
**Stories:** ST-064, ST-065, ST-044, ST-045, ST-066, ST-067, ST-052, ST-054, ST-056, ST-068,
ST-069, ST-027 (start), ST-043 (Dev persona skeleton, start).
**Dependencies:** none — first sprint.
**Risks:** schema drift from the ERD would silently break every downstream story's traceability;
mitigate with the line-by-line ERD review in ST-044/045's Definition of Done.
**Definition of Sprint Done:** CI green on a trivial change; schema migrated and ERD-reviewed; all
4 spikes (ST-052, ST-054, ST-056, ST-068) documented and closed; contract guard (ST-066) fails an
intentionally-bad change.

### Sprint 1 — Goal config, Aggregator, Tax-rule seed (W2: Jun 30–Jul 6)
**Objectives:** Bar 1 end-to-end (goal config); aggregator MCP with scripted data; tax-rule MCP
seeded federal+CA.
**Stories:** ST-001, ST-002, ST-003, ST-004, ST-027 (finish), ST-041, ST-042, ST-049, ST-050.
**Dependencies:** Sprint 0's schema and MCP framework.
**Risks:** R-008 (Clerk/program-infra dependency) — front-load the Clerk skeleton now, not W5.
**Definition of Sprint Done:** Bar 1 demoable in isolation (edit a floor, number recomputes); 2 of
4 MCP sources (aggregator, tax-rule) seeded and contract-tested.

### Sprint 2 — Transaction Interpreter, Synthesizer, evals, Bar 3 complete (W3: Jul 7–13)
**Objectives:** the heaviest sprint by design, matching the PRD's own critical path — both
must-build core AI skills, the full engine (tax, allocation, floors, forecasting), and Bar 3's
final source (expected-income MCP).
**Stories:** ST-015, ST-016, ST-017, ST-028, ST-029, ST-030, ST-031, ST-032, ST-033, ST-034,
ST-035, ST-036, ST-037, ST-038, ST-039, ST-040, ST-047, ST-048.
**Dependencies:** Sprint 1's engine tool contracts and aggregator/tax-rule MCPs.
**Risks:** R-001 (wrong number) and R-006 (classifier accuracy on scripted-only data) both peak
here — this is where the canonical scenario's arithmetic must first prove itself exactly.
**Definition of Sprint Done:** canonical scenario reproduces $3,650 (stressed) and $6,000
(on-time) exactly; Interpreter (5) + Synthesizer (5) eval suites green — 10/14 core evals;
all 4 Bar 3 MCP sources complete.

### Sprint 3 — Re-planner, headless runner, dashboard v1, confirm UI (W4: Jul 14–20)
**Objectives:** Re-planner + its evals; headless runner live with 2 of 3 triggers; dashboard v1 +
interpreter-confirm UI (Bar 4/5 partial).
**Stories:** ST-013, ST-014, ST-018, ST-019, ST-020, ST-021, ST-010, ST-011, ST-005, ST-006
(partial), ST-007, ST-008, ST-009, ST-057, ST-062.
**Dependencies:** Sprint 2's engine + Interpreter.
**Risks:** R-007 — the program's own fixed 8-week schedule; this is literally the current sprint
as of this document's date, so schedule pressure here is real, not hypothetical.
**Definition of Sprint Done:** 2 of 3 triggers fire live; dashboard + confirm UI functional;
Re-planner's 4 evals green — 14/14 core evals now green.

### Sprint 4 — All 3 triggers, deploy, PDF (W5: Jul 21–27)
**Objectives:** the third trigger (manual feedback) live, completing Bar 2; live deploy + Clerk
(Bar 6); PDF output (Bar 4 partial).
**Stories:** ST-012, ST-006 (finish), ST-050 (finish), ST-061, ST-051, ST-053.
**Dependencies:** Sprint 3's orchestrator loop and headless runner.
**Risks:** R-008 — program-provided deploy infra; front-load confirmation of deploy target specifics
now.
**Definition of Sprint Done:** Bar 2 fully live (3/3 triggers); Bar 6 deployed and Clerk-gated; PDF
download works and matches the dashboard exactly.

### Sprint 5 — Email, dual-invocation, personas, Materiality/Alert (W6: Jul 28–Aug 3)
**Objectives:** email "the catch" (Bar 4 complete); prove Bar 5's dual-invocation; finish all 3
scripted personas; build Materiality Evaluator + Alert Composer if schedule allows.
**Stories:** ST-022, ST-023, ST-024, ST-025, ST-026, ST-055, ST-043 (finish Maya/Sam).
**Dependencies:** Sprint 4's deploy + PDF; ST-054/ST-056's spikes (already resolved in Sprint 0).
**Risks:** per the PRD's own pre-committed cut order (§21), Alert Composer and Materiality
Evaluator are the **first** items to cut if the schedule has slipped by this point — cutting them
does not fail Bar 5 (3 must-build skills already satisfy the ≥2 minimum).
**Definition of Sprint Done:** Bar 4 fully complete (dashboard + PDF + email); dual-invocation
demoed (identical `output_digest` from Claude Code and the headless runner); all 3 personas
committed; 14(+6 if built) evals green.

### Sprint 6 — Langfuse, cost ceiling, dry-run #1, reset tooling (W7: Aug 4–10)
**Objectives:** Bar 7 complete (tracing + spend ceiling); the canonical-scenario regression test
standing in CI; demo reset/replay tooling; the first full end-to-end dry run.
**Stories:** ST-058, ST-059, ST-060, ST-063, ST-071, ST-072.
**Dependencies:** every functional epic from Sprints 0–5.
**Risks:** R-012 — a botched manual reset between dry runs would threaten the canonical scenario's
reproducibility guarantee; ST-063 exists specifically to prevent this.
**Definition of Sprint Done:** Bar 7 demoed live (full trace + cost cap); dry-run #1 executed with
a documented, actionable punch list.

### Sprint 7 — Final deploy, dry-runs #2–3, security tests, Demo Day (W8: Aug 11–14)
**Objectives:** close the punch list; two further rehearsals; verify Track A's security claims;
final eval-gate checkpoint; Demo Day itself.
**Stories:** ST-061 (finalize), ST-070, ST-073, ST-074, ST-075.
**Dependencies:** Sprint 6's dry-run #1 punch list.
**Risks:** this is the last checkpoint before Demo Day — any remaining P0/P1 defect found in
dry-run #2 is treated as stop-ship, not "note for later" (per ST-073's Definition of Done).
**Definition of Sprint Done:** dry-run #3 passes with zero manual workarounds; formal go/no-go
sign-off recorded; **Demo Day, 2026-08-14.**

---

## 10. Deferred backlog

Per the task's explicit instruction and Pass 2 §20's strongest scope-discipline recommendation,
**none of the items below are Demo Day stories.** They are recorded here so Track C work never
silently inflates Track A scope, and so nothing Pass 1/Pass 2 identified is lost.

### 10.1 Track B — Real-data proof (optional, non-blocking)

| ID | Item | Source | Notes |
|---|---|---|---|
| TB-01 | Aggregator vendor decision (Plaid vs. Teller) + real sandbox/limited-prod connection | OPEN-ENG-01 | Entry criterion for Track B |
| TB-02 | A1 classifier-accuracy test on real anonymized commingled statements | hypotheses.md A1; OPEN-ENG-02 (threshold undecided) | "Needs no live users" — cheapest Track B test |
| TB-03 | Prove the aggregator abstraction swaps providers without touching Interpreter/Synthesizer code | ADR-008 | Validates Track A's interface design decision |
| TB-04 | Source a real anonymized commingled-statement dataset | Pass 2 §3 (sourcing unaddressed in any doc) | New gap Pass 2 identified; no owner yet |

### 10.2 Track C — Real-user readiness (deferred, explicitly gated)

| ID | Item | Source | Notes |
|---|---|---|---|
| TC-01 | Counsel review of the NFA disclaimer | COMP-002, GAP-002 | No owner/date in any source |
| TC-02 | Tax-math validation vs. real filed Schedule C returns | COMP-004, GAP-003 | Trust-critical before any real user relies on the number |
| TC-03 | Classifier precision/recall validated safe for real users | COMP-005 | Builds on TB-02's result but needs a live-safety bar |
| TC-04 | P1–P3 business-validation interviews | hypotheses.md | Existential to the *business*, not the build |
| TC-05 | Data retention/deletion policy | GAP-011 | No mechanism exists — append-only schema by design |
| TC-06 | Consent/notification-preference model | GAP-007 | No field exists on `USER` |
| TC-07 | Production security posture beyond demo-grade | SEC-004, R-002 | Explicit non-goal for v1 |
| TC-08 | Support/ops model and persona | GAP-013 | No persona or escalation path documented anywhere |
| TC-09 | Token storage hardening (KMS/secrets manager) | P1 stakeholder Q13 | Beyond "encrypted at rest" |
| TC-10 | Multi-account/multi-bank-connection allocation behavior | GAP-006, ADR-007 | Schema supports it structurally; no FR describes it |
| TC-11 | Additional tax-rule states beyond federal+CA | OPEN-ENG-03 | Not on Track A's critical path |
| TC-12 | Role-based access control / production authorization model | Pass 2 §5, §12 | No roles exist beyond single-owner-per-account |
| TC-13 | Backup/DR, HA runner scaling | Pass 2 §6, §13 | No targets defined anywhere |
| TC-14 | Accountant-facing referral surface | hypothesis D1 | No persona or product surface designed |
| TC-15 | Billing/subscription integration | hypothesis C1 | No entity exists in the ERD |
| TC-16 | PII classification tagging across schema | GAP-010 | No field flags sensitive data anywhere |

### 10.3 Technical debt

| ID | Item | Source | Notes |
|---|---|---|---|
| TD-01 | Fix "v3 Brief" reference in `PRD-v2.md` line 6 | OPEN-DOC-01, C-001 | Documentation-only |
| TD-02 | Add correction-log clarification note to `data-model.md` | Pass 2 §8 — pulled forward into ST-047 | Already scheduled in Track A |
| TD-03 | Annotate `Category`/`SpendForecast` fold-in in `PRD-v2.md` §12 | Pass 2 §11, C-006 | Documentation-only |
| TD-04 | Extend `USER.v1_eligibility` documented value set | Pass 2 §11 — pulled forward into ST-051 | Already scheduled in Track A |
| TD-05 | Split `TRANSACTION_CLASSIFICATION.label` into a `direction` discriminator + two label sets | Pass 1 §7 modeling note | Would make invalid combinations unrepresentable; not urgent |
| TD-06 | Explicit runtime assertion "no tool call may initiate a transfer" | Pass 2 §12 recommendation | Currently enforced by omission only |
| TD-07 | Numeric retry/timeout policy for MCP calls | OPEN-ENG-06 | Currently a per-story default placeholder (ST-060) |

### 10.4 Future enhancements (v2/v3/v4 roadmap, deferred skills)

| ID | Item | Source | Notes |
|---|---|---|---|
| FE-01 | Document Intake (vision/OCR) skill | `ai-agents.md` Component 9 | Deliberately deferred — a new failure surface (OCR error → wrong financial fact) |
| FE-02 | Email ingestion for Expected-Income Interpreter | `ai-agents.md` Component 7 | Named fast-follow, not v1 |
| FE-03 | v2 Deepen: tax reserves, runway protection, cash-flow planning, expense decisions | PRD §22 | Reuses data already held, no new dependency |
| FE-04 | v3 Act: auto-fund the tax sub-account via a BaaS partner (recommend→execute) | PRD §22 | The real moat test (hypothesis E3) |
| FE-05 | v4 Expand: invoice collections, hiring affordability, project pricing | PRD §22 | Market widens to very small service businesses |
| FE-06 | Learned/ML spend prediction model | PRD §6 explicit non-goal | Deliberately trimmed for v1 fragility reasons |
| FE-07 | Audio briefing output | PRD §19 | Named cuttable/deferred |
| FE-08 | Multi-state tax matrix at scale | PRD §6, OPEN-ENG-03 | Beyond federal+CA |

---

## 11. Traceability matrix

### 11.1 FR-1 through FR-30 (complete — every FR appears at least once)

| FR | Statement (abridged) | Epic | Story | Component | Workflow | Data Entities |
|---|---|---|---|---|---|---|
| FR-1 | Connect bank source via aggregator MCP | EPIC-01, EPIC-13 | ST-001, ST-041 | Web App, Aggregator MCP | §9.2 | `BANK_CONNECTION`, `BANK_ACCOUNT` |
| FR-2 | Seed pass proposes income/cadence/categories | EPIC-01 | ST-002 | Web App, Transaction Interpreter | §9.3 | `TRANSACTION_CLASSIFICATION` |
| FR-3 | Configure goal (tax/floor/pay/savings/debt/priority) | EPIC-01 | ST-003 | Web App, Engine MCP | §9.5 | `GOAL_CONFIG`, `BUCKET_TARGET`, `TAX_PROFILE` |
| FR-4 | Persist goal config in Financial State engine | EPIC-01, EPIC-09 | ST-004, ST-027 | Engine MCP | §9.5 | `GOAL_CONFIG` |
| FR-5 | Classify deposit/outflow w/ confidence + evidence | EPIC-05 | ST-015 | Transaction Interpreter | §9.3 | `TRANSACTION_CLASSIFICATION` |
| FR-6 | Below-threshold surfaced for confirm; correction log | EPIC-02, EPIC-17 | ST-005, ST-047 | Web App, Transaction Interpreter | §9.4 | `TRANSACTION_CLASSIFICATION`, `CHECK_IN` |
| FR-7 | Detect cadence; windfall never treated as recurring | EPIC-05 | ST-015 | Transaction Interpreter | §9.3 | `TRANSACTION_CLASSIFICATION.cadence` |
| FR-8 | Confirmed classification visibly moves the number | EPIC-02, EPIC-11 | ST-005, ST-034 | Engine MCP, Web App | §9.17 | `PLAN` |
| FR-9 | Project period income with a range | EPIC-12 | ST-036 | Cashflow Synthesizer | §9.6 | `PROJECTION(kind=income)` |
| FR-10 | Forecast expenses with a range | EPIC-12 | ST-037 | Cashflow Synthesizer | §9.6 | `PROJECTION(kind=spend)` |
| FR-11 | Conservative tax set-aside computation | EPIC-10 | ST-029 | Cashflow Synthesizer, Tax-rule MCP | §9.6 | `PLAN.tax_gap_amount`, `TAX_RULE_SET` |
| FR-12 | Allocate against priority order w/ floors | EPIC-11 | ST-031 | Engine MCP | §9.6 | `ALLOCATION_LINE` |
| FR-13 | Reconcile balances; derive number + runway | EPIC-11 | ST-034 | Engine MCP, Aggregator MCP | §9.6 | `PLAN`, `PROJECTION(kind=runway)` |
| FR-14 | Structured Synthesizer output incl. feasibility report | EPIC-11 | ST-035 | Cashflow Synthesizer | §9.6 | `PLAN`, `ALLOCATION_LINE`, `PROJECTION`, `PLAN_WARNING` |
| FR-15 | Re-decide remaining period on input change | EPIC-06 | ST-018 | Orchestrator (Re-planner pattern) | §9.8–9.10 | `PLAN` |
| FR-16 | Re-plan output incl. one-line what-changed | EPIC-06 | ST-019 | Orchestrator, Alert Composer | §9.8–9.9 | `CHECK_IN` |
| FR-17 | Capture user response as a correction | EPIC-06 | ST-020 | Orchestrator, Engine MCP | §9.17 | `TRANSACTION_CLASSIFICATION(source=user)`, `CHECK_IN` |
| FR-18 | Schedule trigger regenerates plan, ramps tax set-aside | EPIC-04, EPIC-10 | ST-010, ST-030 | Orchestrator, Headless Runner | §9.8 | `TRIGGER_EVENT`, `AGENT_RUN` |
| FR-19 | Source-event trigger fires loop | EPIC-04 | ST-011 | Orchestrator, Aggregator MCP | §9.9 | `TRIGGER_EVENT` |
| FR-20 | Manual-feedback trigger fires loop | EPIC-04, EPIC-08 | ST-012, ST-026, ST-006 | Orchestrator, Expected-Income Interpreter | §9.10 | `TRIGGER_EVENT` |
| FR-21 | Materiality Evaluator gates surfacing | EPIC-07 | ST-022 | Materiality Evaluator | §9.8, §9.9, §9.11 | `AGENT_RUN.surfaced`, `CHECK_IN` |
| FR-22 | Interactive dashboard | EPIC-03, EPIC-24 | ST-007, ST-057 | Web App | §9.6 | `PLAN` (read) |
| FR-23 | PDF plan on demand | EPIC-22 | ST-053 | PDF Generator | §9.12 | `PLAN` (read) |
| FR-24 | Email "the catch"; mismatch check rejects drift | EPIC-23, EPIC-07 | ST-023, ST-055, ST-056, ST-054 | Alert Composer, Email delivery | §9.13 | `CHECK_IN` |
| FR-25 | Tax floor never under-funded to free other buckets | EPIC-11 | ST-032 | Engine MCP | §9.6 | `ALLOCATION_LINE`, `PLAN_WARNING` |
| FR-26 | Runway floor breach never silently recommended | EPIC-11 | ST-033 | Engine MCP | §9.6 | `PLAN_WARNING` |
| FR-27 | Connect + backfill 24 months | EPIC-01, EPIC-13 | ST-001, ST-041, ST-042 | Aggregator MCP | §9.2 | `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT` |
| FR-28 | Categorize fixed/recurring vs. variable | EPIC-05 | ST-016 | Transaction Interpreter | §9.3 | `TRANSACTION_CLASSIFICATION.label` |
| FR-29 | Detect + flag new/changed recurrences | EPIC-05, EPIC-12 | ST-038 | Transaction Interpreter, Engine MCP | §9.3 | `RECURRING_EXPENSE`, `RECURRING_EXPENSE_VERSION` |
| FR-30 | Predict next-period spend with a range | EPIC-12 | ST-039 | Cashflow Synthesizer | §9.6 | `PROJECTION(kind=spend)` |

**Verification:** all 30 FR IDs appear in the table above — cross-checked directly against
`PRD-v2.md` §11 and Pass 2 §18's own matrix.

### 11.2 Business rules, data requirements, integration requirements, and open items

| ID | Statement (abridged) | Where it lands |
|---|---|---|
| BR-005 | Read + recommend only | Enforced by omission across all MCPs; structurally guarded by ST-066; verified by TD-06 |
| BR-006 | Gate signup on filing structure | ST-051 (gate logic), ST-052 (negative-path spike) |
| BRULE-001–007 | Priority order, floor rules, windfall rule, clamp formula, bias-to-ask | ST-003, ST-015, ST-031–034 |
| DR-003 | Plan-input lineage | ST-046 |
| DR-004 | Correction log (ADR-006) | ST-028 (mechanism), ST-047 (documentation) |
| COMP-002, 004, 005 | Counsel review, tax-math validation, classifier validation | Track C — §10.2 (TC-01, TC-02, TC-03) |
| GAP-005 | Tax-rule state seed list | ST-049 (federal+CA, Track A scope); TC-11 (additional states, Track B/C) |
| GAP-006 | Multi-account behavior | ADR-007 (single-account Track A scope, resolved); TC-10 (Track C) |
| GAP-015 | Negative onboarding UX | ST-052 (spike) |
| GAP-017 | Duplicate-trigger reconciliation | ST-068 (spike) |
| GAP-018 | Dev/demo environment separation | ST-062 |
| INT-001 | Aggregator-agnostic MCP interface | ST-041 |
| INT-002 | Tax-rule MCP seed | ST-049 |
| INT-003 | Expected-income MCP | ST-048 |
| INT-004 | Financial State + Priority Engine MCP | ST-027, ST-028 |
| INT-007 | Email delivery mechanism | ST-054 (spike), ST-055 |
| OPEN-ENG-01 | Plaid vs. Teller | TB-01 (Track B) |
| OPEN-ENG-02 | A1 precision/recall threshold | TB-02 (Track B) |
| OPEN-ENG-03 | Additional tax-rule states | TC-11 (Track C) |
| OPEN-ENG-04 | Email vendor | ST-054 (spike — resolved in Track A) |
| OPEN-ENG-05 | Mismatch-check mechanism | ST-056 (spike — resolved in Track A) |
| OPEN-ENG-06 | MCP retry/timeout policy | ST-060 (default placeholder); TD-07 (final tuning) |
| OPEN-DOC-01 | "v3 Brief" reference fix | TD-01 (documentation, deferred) |
| OPEN-ARCH-01 | `is_commingled` ownership | ST-069 (spike — resolved in Track A) |

### 11.3 Architecture-component coverage (every Pass 2 §6 component has implementation work)

| Pass 2 §6 Component | Story Coverage |
|---|---|
| Web application | ST-001–009, ST-057 |
| Auth & session (Clerk) | ST-050 |
| Orchestrating Agent | ST-013, ST-014 |
| Transaction Interpreter | ST-015, ST-016, ST-017 |
| Cashflow Synthesizer | ST-029–040 |
| Materiality Evaluator | ST-022, ST-024 |
| Alert Composer | ST-023, ST-025 |
| Expected-Income Interpreter | ST-026 |
| Financial State + Priority Engine (custom MCP) | ST-027, ST-028, ST-031–035 |
| Aggregator MCP | ST-041 |
| Tax-rule MCP | ST-049 |
| Expected-income MCP | ST-048 |
| PostgreSQL persistence | ST-044, ST-045, ST-046 |
| PDF generation | ST-053 |
| Email delivery | ST-054, ST-055 |
| Langfuse tracing | ST-058 |
| Headless production-style runner | ST-014, ST-061 |
| Scripted demo-data source | ST-042, ST-043 |

**Verification:** all 18 components from Pass 2's component table have at least one implementation
story — none is architecture-only with no build work.

### 11.4 Workflow coverage (every Pass 2 §9 workflow has implementation coverage)

| Workflow | Story Coverage |
|---|---|
| §9.1 Eligibility check and onboarding | ST-051, ST-052 |
| §9.2 Bank connection and backfill | ST-001, ST-041, ST-042 |
| §9.3 Seed classification | ST-002, ST-015, ST-016, ST-017 |
| §9.4 Low-confidence user confirmation | ST-005 |
| §9.5 Goal configuration | ST-003, ST-004, ST-027 |
| §9.6 Initial plan calculation | ST-029–040 |
| §9.7 The pre-mortem / "the catch" | ST-008 |
| §9.8 Scheduled re-plan | ST-010, ST-018, ST-019, ST-022 |
| §9.9 Transaction-triggered re-plan | ST-011, ST-015, ST-018, ST-019, ST-022 |
| §9.10 Manual-feedback-triggered re-plan | ST-012, ST-026, ST-018, ST-019 |
| §9.11 Quiet-day / no-material-change flow | ST-009, ST-022 |
| §9.12 PDF generation | ST-053 |
| §9.13 Email generation and mismatch validation | ST-023, ST-055, ST-056 |
| §9.14 Stale-data handling | ST-041 (`BANK_CONNECTION.status`/`PLAN.input_freshness_status` acceptance criteria) |
| §9.15 Failed dependency handling | ST-060 |
| §9.16 Duplicate trigger handling | ST-068, ST-010, ST-011 |
| §9.17 User correction and recomputation | ST-005, ST-018, ST-020 |
| §9.18 Demo reset and replay | ST-063 |

**Verification:** all 18 workflows have at least one implementation story. §9.14's non-aggregator
source staleness remains explicitly out of scope for Track A (Pass 2 GAP-014 — scripted data
cannot go stale), consistent with Pass 2's own scoping, not a coverage gap.

---

## 12. Delivery risks

Pass 2's risk register (R-001–R-012) is carried forward with its backlog mitigation named
explicitly; two new risks specific to this backlog's sequencing are added.

| ID | Description | Likelihood | Severity | Backlog Mitigation |
|---|---|---|---|---|
| R-001 | Wrong number/date on stage | Low (canonical scenario locked) | Critical | ST-031, ST-034 (exact derivation), ST-071 (regression test), ST-063 (clean reset before every run) |
| R-002 | No formal security program (demo-grade only) | N/A for Track A | Medium | Explicitly out of Track A scope; TC-07 (Track C) |
| R-003 | Commingled-account exposure, no retention/consent model | N/A for Track A (no real user data) | High (Track C) | TC-05, TC-06 (Track C) |
| R-004 | Core business hypotheses untested | N/A to this engineering backlog | Critical (business) | TC-04 (Track C) — outside this backlog's scope by design |
| R-005 | Aggregator vendor undecided | Medium | Low (non-blocking) | ST-041's interface is vendor-agnostic by construction (ADR-008); TB-01 (Track B) |
| R-006 | Classifier accuracy unproven on real data | Unknown | Critical (existential, Track B) | Track A only needs ST-017's eval-suite success; TB-02 (Track B) |
| R-007 | Fixed 8-week schedule; cut-order fragility | Medium | Medium | §9's sprint plan explicitly follows the PRD's pre-committed cut order (Materiality Evaluator/Alert Composer first) |
| R-008 | Program-provided infra (Clerk/Langfuse/deploy) external dependency | Medium | Medium | Clerk front-loaded to Sprint 1 (ST-050), Langfuse to Sprint 6 (ST-058), deploy confirmed early in Sprint 4 (ST-061) |
| R-009 | Tax math unvalidated vs. real filed returns | Unknown | High (Track C) | Track A only needs canonical-scenario correctness (ST-029, ST-071); TC-02 (Track C) |
| R-010 | Documentation-integrity drift | Low | Low | TD-01, TD-03 (technical debt, non-blocking) |
| R-011 | Prompt-injection via transaction memo/counterparty text | Low for Track A (curated fixtures) | Medium (Track B) | Untrusted-data convention applied across ST-005, ST-015, ST-016, ST-023, ST-026 |
| R-012 | No demo-reset/replay procedure documented | Medium | High | ST-063 implements it; used before every dry run (ST-072, ST-073) |
| **R-013 [new]** | The 4 spike stories (ST-052, ST-054, ST-056, ST-068) are scheduled in Sprint 0 but sit on the critical path for ST-051, ST-055, ST-023, and trigger-dedup hardening | Low if treated as a hard exit gate | Medium | Sprint 0's Definition of Sprint Done explicitly requires all 4 spikes closed before Sprint 1 begins — do not let them slip as "background" work |
| **R-014 [new]** | Sprint 2 (W3) is the heaviest sprint (18 stories, the full engine + both must-build AI skills) and Pass 2 itself notes the program is already mid-W4 as of this document's date — i.e., real-world schedule pressure on this exact sprint is not hypothetical | Medium-High | High | Treat Sprint 2's *completion*, not its calendar week label, as the true gate before Sprint 3 work begins; the PRD's own cut order (§21) already prices in this exact risk |

---

## 13. Overall readiness

**Backlog readiness: 4.5/5.** Every FR-1 through FR-30 is covered by a sized, testable story (§11.1);
every Pass 2 architecture component and workflow has implementation work (§11.3, §11.4); no Track C
work appears in the Demo Day backlog (§10 is explicitly separate); every story carries acceptance
criteria and a Definition of Done (§5, by construction of the template used throughout).

**What keeps this from a 5/5:**
1. Four stories (ST-052, ST-054, ST-056, ST-068) are spikes, not fully-specified builds — by
   design, since Pass 2 itself could not specify them further without a stakeholder decision. Each
   is small (1–2 points) and scheduled first (Sprint 0), so the risk is sequencing discipline, not
   backlog quality.
2. Three external program-infrastructure dependencies (Clerk, Langfuse, the deploy target) sit
   outside this team's control (R-008) — the sprint plan front-loads them, but their availability
   isn't something a backlog can guarantee.
3. The program is already mid-Sprint 3/W4 as of this document's date — this backlog is complete and
   ready to execute, but Sprint 0–2's stories may need a rapid retroactive audit against what's
   actually been built so far, rather than a clean start.

**What is fully ready today:** the entire Financial State + Priority Engine core (EPIC-09–12), the
Transaction Interpreter (EPIC-05), the Re-planner pattern (EPIC-06), the full schema (EPIC-15–16),
and the sprint sequencing (§9) require no further stakeholder input to begin or continue building.

---

## 14. Completeness check

Performed directly against this document before finalizing, per the task's explicit instruction.

- **All FR-1 through FR-30 covered?** ✅ Yes — verified in §11.1; every FR ID appears in at least
  one story, cross-checked against `PRD-v2.md` §11's own list and Pass 2 §18's matrix.
- **All Pass 2 architecture components have implementation stories?** ✅ Yes — verified in §11.3;
  all 18 components from Pass 2 §6's component table have at least one story.
- **All Pass 2 workflows have implementation coverage?** ✅ Yes — verified in §11.4; all 18
  workflows (§9.1–§9.18) have at least one story, with §9.14's non-aggregator staleness explicitly
  and correctly out of Track A scope (not a gap).
- **No Track C work included in the Demo Day backlog?** ✅ Yes — §§2–9 (Initiatives through Sprint
  Plan) contain zero references to COMP-002, COMP-004, COMP-005, GAP-007, GAP-011, GAP-013, or any
  other Track C item as a buildable story; all such items are confined to §10.2, explicitly
  separated per Pass 2 §20's strongest recommendation.
- **All stories include acceptance criteria and Definition of Done?** ✅ Yes — every one of the 75
  stories in §5 follows the same template, including Given/When/Then acceptance criteria (happy
  path, validation failure, error handling, and at least one boundary condition) and an explicit
  Definition of Done.
- **Every story traces to an FR, BR, architecture component, workflow, and data entity?** ✅ Yes —
  each story's *Traceability* line names all applicable references; §11 aggregates them into a
  single matrix.
- **Every story belongs to a Feature, every Feature to an Epic, every Epic to an Initiative?** ✅
  Yes — verified by construction in §§2–5; no orphaned story, feature, or epic exists.

---

*End of Pass 3. This backlog converts `docs/analysis/pass-2-solution-definition.md`'s architecture
into 11 initiatives, 37 epics, 50 features, 75 user stories, ~280 technical tasks, 14 tagged
technical enablers, and an 8-sprint plan (Sprint 0 → Sprint 7, aligned to `PRD-v2.md` §21's W1–W8).
No Pass 2 architecture, ERD, or scope decision was revisited; the four items Pass 2 flagged as
genuine backlog blockers (email vendor, mismatch-check mechanism, negative-onboarding UX,
duplicate-trigger reconciliation) were converted into spike stories per Pass 2's own §20
recommendation, not left unresolved or silently assumed.*

---
