# Headroom — Pass 1 Document Analysis

*Requirements & documentation analysis · analysis-only, no epics/stories/code · generated 2026-07-16*

**Scope of this pass:** every file in the repository as of 2026-07-16 (commit `ad46b17` plus
one uncommitted modification to `README.md` and one untracked new file,
`docs/data-model.md`). This is a **documentation and requirements analysis**, not a design
review — the ERD, architecture, and scope are described, compared, and gap-checked, but not
redesigned.

**How to read this document.** Every conclusion is tagged as one of:
- **[Fact]** — stated directly in a source document (file + section cited).
- **[Interpretation]** — a synthesis across sources; reasonable but not verbatim.
- **[Assumption]** — a judgment call this analysis made where the source was silent or
  ambiguous; listed again in the Assumptions Register (§10).
- **[Recommendation]** — a suggestion for Pass 2 / stakeholders, not a documented requirement.

---

## 1. Executive summary

Headroom is a capstone project (Demo Day **2026-08-14**) building "the first
decision engine in an autonomous financial decision system for one-person and very small
service businesses" — a system that continuously answers *"how much can I safely pay myself
right now?"* for sole-proprietor (Schedule C) freelancers with commingled bank accounts and
lumpy income **[Fact: README.md, docs/onepager.md]**.

The documentation set is unusually mature for an early-stage project: a locked canonical demo
scenario with verifiable arithmetic, an FR-numbered requirements list (FR-1…FR-30) mapped to
seven explicit acceptance bars, a versioned entity-relationship diagram with full plan-input
lineage, and a falsifiable-hypotheses doc that explicitly separates *belief* from *evidence*.
This rigor is itself a signal worth preserving into any backlog.

**However, three structural issues limit readiness for solution design and backlog creation:**

1. **No end-user validation has occurred.** `personas.md` states plainly: *"No customer
   interviews have been conducted yet"* **[Fact: docs/personas.md, "How to read this
   document"]**. The entire architecture, milestone plan, and acceptance bars are being built
   against an unvalidated wedge, while `hypotheses.md` itself ranks interviews (P1/P2) and a
   classifier-accuracy test (A1) as the **cheapest, most existential** things to test *first*
   — yet the PRD's week-by-week milestones (§21) allocate no time to them.
2. **The documentation set describes only one user role** (the freelancer). There is no
   documented persona for support, compliance, risk, admin/ops, or an accountant-facing
   surface — even though the docs themselves invoke a "counsel review" gate and an
   accountant-referral channel hypothesis (D1).
3. **The newest document (`docs/data-model.md`, dated 2026-07-16, uncommitted) is not fully
   reconciled with the PRD's own data-entity list** — most notably, "the correction log," named
   as a first-class concept in both the PRD and the AI-agent design doc, has no explicit
   `CORRECTION` entity in the ERD; it is implicit in `TRANSACTION_CLASSIFICATION` + `CHECK_IN`.

**Overall readiness:** documentation is **mostly ready for solution design** (4/5) and
**partially ready for backlog creation** (3/5) — see the full scorecard in §12. The gaps are
concentrated in validation evidence, non-functional/compliance depth, and a handful of
data-model reconciliation items — not in product vision or core functional scope, which are
unusually clear.

**Headline numbers:** 0 critical contradictions, 3 high-severity contradictions/gaps, 6
blocking gaps (of 19 total gaps identified), 27 stakeholder questions (9 at P0).

---

## 2. Source document inventory

| # | File | Type | Purpose | Key subjects | Status | Relationships |
|---|---|---|---|---|---|---|
| 1 | [README.md](../../README.md) | Index / pitch | Repo entry point; one-paragraph pitch, architecture sketch, doc index | Problem, hero output, scope, trust posture, doc table | **Current**, mid-edit (unstaged diff adds the data-model row — the docs table is being kept in sync with new docs in real time) | Indexes all other docs; the diagram in "How it works" is a condensed version of PRD §9 |
| 2 | [docs/onepager.md](../onepager.md) | Executive brief | One-page investor/stakeholder pitch | Problem, ICP, hero output, solution, differentiation, MVP scope, roadmap, validation questions | Current, v2, dated 2026-07-11 | Companion to PRD v2, Personas, Hypotheses (per its own header) |
| 3 | [docs/PRD-v2.md](../PRD-v2.md) | PRD | Full product requirements for the Demo Day build | Objective, ICP, scope, canonical scenario, 7 acceptance bars, architecture, FR-1…FR-30, data requirements, user flows, evals, milestones, risks, roadmap, open questions | **Current** (v2.0, "Draft for build"), but **supersedes PRD v1.0 (2026-06-27), which is not present anywhere in the repo or git history** — see note below | Central hub; explicitly lists "Companion docs" but see contradiction #1 (§8) |
| 4 | [docs/ai-agents.md](../ai-agents.md) | Architecture / design | Agent, engine, and skills design in depth | One-agent/one-engine rationale, 9 components (Orchestrator + 6 skills + engine + deferred skill), build scope, eval cases | Current, v2, dated 2026-07-11 | Expands PRD §9–§10; referenced from README and data-model.md |
| 5 | [docs/data-model.md](../data-model.md) | ERD / data dictionary | Canonical v1 data model | Mermaid ERD, 24 entities, versioning pattern, plan-input lineage, domain groupings | **Newest doc** (v1, dated 2026-07-16 = today), **untracked in git** (new, not yet committed) | Explicitly cross-references onepager.md, PRD-v2.md, and ai-agents.md; not yet reconciled against PRD §12's entity list (see §7, §8) |
| 6 | [docs/personas.md](../personas.md) | Personas | Primary + 2 secondary end-user archetypes | Jobs-to-be-done, workflows, trust objections, out-of-scope segments, segmentation logic, validation priority list | Current, v2, dated 2026-07-11; **explicitly self-flagged as unvalidated** ("evidence-oriented archetypes," "[Assumption → validate]" tags throughout) | Companion to PRD v2 and onepager; feeds directly into hypotheses.md's test list |
| 7 | [docs/hypotheses.md](../hypotheses.md) | Validation plan | Every product assumption, written to be falsified | 17 hypotheses (P/B/T/C/D/E series) with thresholds and pre-committed decisions, priority-by-existential-risk ordering | Current, v2, dated 2026-07-11 | Companion to PRD v2, Personas, Executive Brief; its own closing section ("What this means for the capstone") is effectively a recommendation the PRD's milestones don't visibly act on |

**Files whose relevance is uncertain / referenced but not found:**
- **PRD v1.0 (2026-06-27)** — cited in `PRD-v2.md` line 5 as the superseded predecessor. Not in
  the repo, not in `git log --all`. Either it lived outside this repo (e.g., a doc tool) or was
  never committed. Its absence removes any ability to audit *what specifically changed* beyond
  the PRD's own self-reported "What changed from v1" table (§1).
- **A "v3 Brief"** — `PRD-v2.md` line 6 lists companion docs as *"v3 Brief · One-pager ·
  Personas · Hypotheses · AI Agent design"* — naming both a "v3 Brief" and a separate
  "One-pager" as if they are two different documents. Only one executive-brief-type document
  exists (`onepager.md`), and its own header labels it **v2**, not v3. Treated in this analysis
  as a documentation inconsistency (see contradiction #1, §8), not a missing file — but it's
  flagged here because it's the kind of dangling reference that should be resolved before
  trusting the doc set as complete.

No unrelated files were found. The repository contains no spreadsheets, configuration files,
API specs, compliance documents, or process-diagram files beyond the one Mermaid ERD embedded
in `data-model.md`.

---

## 3. Product understanding

*(Every bullet cites its source; anything not directly cited is an [Interpretation] or
[Assumption], labeled accordingly.)*

- **Business problem [Fact, README.md / docs/onepager.md]:** Freelancers with irregular income
  can't budget against a fixed paycheck. Every dollar is contested by moving obligations (taxes,
  runway, pay, savings, debt); when reality shifts (late invoice, surprise cost), the allocation
  silently breaks and the user either re-does the math or doesn't — risking an uncoverable tax
  bill.
- **Structural wrinkle [Fact, same]:** Sole proprietors run personal and business money through
  **one commingled account**, making income classification the load-bearing, AI-hard problem —
  not solvable by rules.
- **Product vision [Fact, README.md]:** "The first decision engine in an autonomous financial
  decision system," progressing v1 Decide → v2 Deepen → v3 Act → v4 Expand
  **[Fact, docs/PRD-v2.md §22]**.
- **Business objectives [Fact, docs/PRD-v2.md §2]:** (a) produce and defend a trustworthy
  Safe-to-Pay Number and re-decide it automatically when reality changes; (b) for the capstone
  specifically, satisfy all seven acceptance bars (§8) with proof artifacts on stage.
- **Target users [Fact, docs/personas.md, docs/PRD-v2.md §4]:** Primary — "lumpy-income solo
  pro" (sole-prop Schedule C, irregular income, no bookkeeper, one commingled account).
  Secondary A — steady-retainer solo (milder pain, budgeting-app competitors). Secondary B —
  windfall-prone consultant (episodic large deposits, over-spending risk).
- **Primary user journeys [Fact, docs/PRD-v2.md §13, §18]:** (A) First session / "the catch" —
  connect, 24-mo backfill, seed pass, confirm low-confidence deposits, see the shortfall
  pre-mortem. (B) Re-plan — a trigger fires, the agent classifies/re-computes, one decision
  surfaces. (C) Quiet day — nothing material, no interruption.
- **Core capabilities [Fact, README.md, docs/PRD-v2.md §6, §11]:** bank connect + backfill; AI
  transaction/deposit classification with confidence + one-tap confirm; deterministic priority
  waterfall with hard floors; conservative Schedule C tax estimate; the Safe-to-Pay Number
  (range + reasoning); background re-planning on 3 trigger types; earned-attention alerting;
  dashboard + PDF + email outputs.
- **Expected business outcomes [Fact/Interpretation, docs/onepager.md, docs/hypotheses.md]:**
  Near-term — pass all 7 Demo Day bars. Medium-term (explicitly *unproven*, framed as
  hypotheses) — users act on the number rather than re-checking it (B1); users pay $15–30/mo
  for prevention (C1); accountants become a distribution channel (D1).
- **Success metrics [Fact, docs/hypotheses.md]:** Not product KPIs in the conventional sense —
  each hypothesis carries its own success/failure *threshold* (e.g., P1: ≥70% of interviewees
  describe monthly-or-more owner-pay uncertainty; B1: ≥3 of 5 concierge users act on the number
  without re-deriving it themselves). There is **no aggregate product-level success metric**
  (e.g., activation rate, retention, NPS) defined anywhere — see gap GAP-014.
- **Major systems/entities [Fact, docs/PRD-v2.md §9, docs/data-model.md]:** One orchestrating
  agent (Agent SDK); one deterministic engine (custom "Financial State + Priority Engine" MCP);
  3 other MCP sources (Aggregator, Tax-rule, Expected-income); Postgres-backed Financial State
  store [Fact, PRD §9 "Stack assumptions"]; Clerk auth; Langfuse tracing.
- **Regulatory/security/privacy/operational considerations [Fact, docs/PRD-v2.md §15–§16,
  docs/onepager.md]:** Read-and-recommend-only (never moves money); "Not financial or tax
  advice" (NFA) posture with counsel review scheduled *before* the tax engine is trusted for
  real users; access tokens encrypted at rest and never exposed to the frontend; demo-grade
  security only, explicitly **not** SOC 2; no real PII on stage; cost/spend ceiling per agent
  run; Langfuse tracing on every agentic loop.

---

## 4. Requirement catalog

Confidence definitions used throughout this catalog:
- **High** — stated verbatim or near-verbatim, usually with its own ID, in a source document.
- **Medium** — synthesized consistently across ≥2 sources; not itself ID'd in the source.
- **Low** — inferred from an [Assumption → validate] tag in the source, or from a design choice
  not explicitly justified as a requirement.

Related business objectives referenced below (defined once here to avoid repetition):
**BO-1** Prove the agent+engine "decision system" thesis is trustworthy and demoable.
**BO-2** Validate the core problem is real, frequent, and monetizable.
**BO-3** Preserve trust: the number must be accurate, conservative, and auditable.
**BO-4** Keep the architecture/data model extensible along the v1→v4 roadmap.
**BO-5** Deliver all 7 acceptance bars inside the fixed 8-week program schedule.

### 4.1 Business requirements

| ID | Statement | Source | Actor | Objective | Confidence | Notes |
|---|---|---|---|---|---|---|
| BR-001 | Produce and defend a trustworthy, forward-looking Safe-to-Pay Number for sole-prop Schedule C freelancers with irregular income | PRD-v2.md §2 | Primary persona | BO-1, BO-3 | High | The product's single stated objective |
| BR-002 | Satisfy all seven Demo Day acceptance bars live, with proof artifacts, by 2026-08-14 | PRD-v2.md §2, §8 | Program evaluators | BO-5 | High | "the build is the rubric" |
| BR-003 | Test the cheapest existential hypotheses (problem frequency/severity, classifier accuracy) before or during the build | hypotheses.md, "What this means for the capstone" | Product owner | BO-2 | High (as a stated intent) / **not executed as of this doc's date** | See GAP-001, contradiction #3 |
| BR-004 | Progress the product along a defined roadmap: v1 Decide → v2 Deepen → v3 Act → v4 Expand | onepager.md, PRD-v2.md §22 | Product owner | BO-4 | High | Framed explicitly as "positioning, not v1 scope" |
| BR-005 | Maintain a strict "read + recommend only, not financial/tax advice" trust posture as a business constraint, not just a UX detail | onepager.md, PRD-v2.md §15 | All users | BO-3 | High | Ties directly to liability/regulatory exposure |
| BR-006 | Gate signup on filing structure so Schedule-C-only logic is never silently applied to an S-corp/multi-member user | personas.md (scope table), PRD-v2.md §4 | Prospective users outside ICP | BO-3 | High | "A wrong number here churns your highest-value users angry" |
| BR-007 | Treat competitive positioning as "the intelligence layer above any bank account," not money movement (already commoditized by Found/Lili/Novo) | onepager.md | Product owner / market | BO-2 | Medium | Strategic framing rather than a testable requirement |

### 4.2 Functional requirements

PRD-v2.md §11 already assigns FR-1…FR-30; they are preserved verbatim below rather than
renumbered, to keep source traceability intact.

| ID | Statement (abridged) | Source | Actor | Objective | Confidence |
|---|---|---|---|---|---|
| FR-1 | Connect a bank source (sandbox/scripted for demo) via the aggregator MCP | PRD §11.1 | Primary persona | BO-5 | High |
| FR-2 | Seed pass: propose detected income/cadence/categories from backfill; user confirms/corrects | PRD §11.1 | Primary persona | BO-1 | High |
| FR-3 | Configure the goal: tax profile, runway floor, target pay, savings, debt, priority; defaults proposed, editable | PRD §11.1 | Primary persona | BO-1 | High |
| FR-4 | Persist goal config in the Financial State engine | PRD §11.1 | System | BO-1 | High |
| FR-5 | Classify each deposit/outflow with confidence score + extracted evidence | PRD §11.2 | Transaction Interpreter (AI) | BO-1, BO-3 | High |
| FR-6 | Below-threshold items surfaced for one-tap confirm, never silently assumed; written to correction log | PRD §11.2 | Primary persona | BO-3 | High — but see DR-004 / contradiction #4 on where "correction log" lives in the ERD |
| FR-7 | Detect cadence (project/retainer/windfall); never treat a windfall as recurring | PRD §11.2 | Transaction Interpreter | BO-3 | High |
| FR-8 | A confirmed classification visibly moves the Safe-to-Pay Number | PRD §11.2 | Primary persona | BO-1 | High |
| FR-9 | Project period income with a range | PRD §11.3 | Cashflow Synthesizer | BO-1 | High |
| FR-10 | Forecast expenses with a range (detected recurring + trailing/seasonal average, no learned model) | PRD §11.3 | Cashflow Synthesizer | BO-1 | High |
| FR-11 | Compute conservative tax set-aside (SE + federal brackets + QBI + half-SE deduction) | PRD §11.3 | Cashflow Synthesizer | BO-1, BO-3 | High |
| FR-12 | Allocate against priority order, respecting safety floors | PRD §11.3 | Cashflow Synthesizer | BO-1 | High |
| FR-13 | Reconcile to actual balances; derive Safe-to-Pay + runway forecast | PRD §11.3 | Cashflow Synthesizer | BO-1 | High |
| FR-14 | Structured output: number+range+reasoning, per-bucket allocation, income/runway projection, tax-bomb status, feasibility report | PRD §11.3 | Cashflow Synthesizer | BO-1 | High — "feasibility report" has no dedicated ERD entity (see §7) |
| FR-15 | Re-decide remaining period on input change; protect floors, re-allocate optional buckets | PRD §11.4 | Re-planner (agent pattern) | BO-1 | High |
| FR-16 | Output: revised allocation+number, updated projections, the one decision, one-line what-changed | PRD §11.4 | Re-planner | BO-1 | High |
| FR-17 | Capture user's response as a correction | PRD §11.4 | System | BO-3 | High |
| FR-18 | Schedule trigger: cron regenerates plan, ramps tax set-aside near due date | PRD §11.5 | System | BO-1 | High |
| FR-19 | Source-event trigger: transaction webhook fires the loop + interpreter on unclear txns | PRD §11.5 | System | BO-1 | High |
| FR-20 | Manual-feedback trigger: user action (e.g. "Acme paid late") fires the loop | PRD §11.5 | Primary persona | BO-1 | High |
| FR-21 | Materiality Evaluator: surface only if thresholds clear (floor breach, tax proximity, delta, new recurring commitment); else stay silent | PRD §11.5 | Materiality Evaluator (hybrid) | BO-1, BO-3 | High |
| FR-22 | Interactive dashboard: number, allocation, runway, tax-bomb status | PRD §11.6 | Primary persona | BO-5 | High |
| FR-23 | PDF cashflow & tax plan on demand | PRD §11.6 | Primary persona | BO-5 | High |
| FR-24 | Email delivering "the catch"; mismatch check rejects copy that drifts from engine numbers | PRD §11.6 | Alert Composer | BO-3, BO-5 | High |
| FR-25 | Tax set-aside floor never under-funded to free up pay/savings; shortfall flagged instead | PRD §11.7 | Cashflow Synthesizer | BO-3 | High |
| FR-26 | Runway floor breach never recommended without explicit surfaced warning | PRD §11.7 | Cashflow Synthesizer | BO-3 | High |
| FR-27 | Connect bank account(s), backfill up to 24 months | PRD §11.8 | Primary persona | BO-1 | High |
| FR-28 | Categorize transactions fixed/recurring vs. variable/discretionary | PRD §11.8 | Transaction Interpreter | BO-1 | High |
| FR-29 | Detect recurring expenses; flag new/changed recurrences (also a re-plan trigger) | PRD §11.8 | System | BO-1 | High |
| FR-30 | Predict next-period spend with a range (trailing+seasonal, no learned model); feeds runway/number, not a standalone budget view | PRD §11.8 | Cashflow Synthesizer | BO-1 | High |

### 4.3 User experience requirements

| ID | Statement | Source | Actor | Objective | Confidence |
|---|---|---|---|---|---|
| UX-001 | One-tap confirmation UI for low-confidence classifications, showing the evidence | PRD §11.2 (FR-6), §18 demo script | Primary persona | BO-3 | High |
| UX-002 | Earned attention: at most one decision surfaced, or silence — never a dashboard the user must scan | onepager.md, PRD §6, §11.5 | Primary persona | BO-1, BO-2 | High |
| UX-003 | Every figure displayed as a range with its assumption stated; the headline number is always the conservative/low end | PRD §5, §7, §15 | Primary persona | BO-3 | High |
| UX-004 | First session leads with "the catch" (a pre-mortem shortfall) because "the save is the hook" | PRD §5, §13 | Primary persona | BO-2 | High |
| UX-005 | Live-editable goal config that recomputes the number in the UI | PRD §8 Bar 1 | Primary persona | BO-5 | High |

### 4.4 Business rules

| ID | Statement | Source | Confidence |
|---|---|---|---|
| BRULE-001 | Allocation priority is fixed: Taxes → Runway floor → Pay → Savings → Debt | PRD §7, §9, ai-agents.md | High |
| BRULE-002 | Tax set-aside is never under-funded to free optional buckets (FR-25) | PRD §11.7 | High |
| BRULE-003 | Runway floor breach is never silently recommended (FR-26) | PRD §11.7 | High |
| BRULE-004 | Windfalls are never treated as recurring income (FR-7) | PRD §11.2, ai-agents.md Component 2 | High |
| BRULE-005 | Bias to ask (not guess) on high-magnitude, low-confidence deposits | PRD §15, ai-agents.md | High |
| BRULE-006 | The promised Safe-to-Pay figure is always `clamp(balance + income_low − outflow_high − tax_gap − runway_floor, 0, target_pay)` — the low end of the range | PRD §7 | High — verified arithmetically against the canonical scenario ($3,650) |
| BRULE-007 | A confirmed classification must visibly move the number before the demo can claim the AI is load-bearing (the "falsifiability check") | PRD §10, ai-agents.md | High |

### 4.5 Data requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| DR-001 | Financial State entities: GoalConfig, IncomeEvent, ExpectedIncome, Allocation, Projection, Correction, RecurringExpense, SpendForecast, Category, CheckIn | PRD §12 | High (as stated in PRD) |
| DR-002 | Anything mutable (goal config, tax profile, expected income, recurring expenses, classifications) is append-only, versioned via a partial-unique `is_current` flag | data-model.md "How to read it" | High |
| DR-003 | Every `PLAN` records exact input lineage (classification, expected-income, recurring-expense, balance-snapshot, and tax-rule-set versions) via `PLAN_INPUT_*` join tables, plus `input_digest`/`output_digest` | data-model.md | High |
| DR-004 | User corrections/overrides are captured as a durable "correction log" that biases future classification | PRD §12, ai-agents.md (multiple) | Medium — **the ERD has no dedicated `CORRECTION` entity**; this is implemented (by interpretation) via `TRANSACTION_CLASSIFICATION(source=user)` + `CHECK_IN.resulting_classification_id`. Flagged as contradiction #4 (§8) |
| DR-005 | Raw transaction ingestion is immutable (`ingested_at immutable`) | data-model.md | High |
| DR-006 | Tax rule sets are versioned and cited (source, citation, checksum, published_date) | data-model.md | High |
| DR-007 | `TRANSACTION_CLASSIFICATION.label` is a single enum spanning both deposit-side (`income|transfer|refund|repayment|loan|other`) and outflow-side (`fixed_recurring|variable_discretionary`) values | data-model.md | High (as modeled) — flagged as a modeling note in §7, not a contradiction |

### 4.6 Integration requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| INT-001 | Aggregator MCP behind a provider-agnostic interface (`get_transactions`, `get_balances`, `get_accounts`) so Plaid or Teller can sit behind it | PRD §9, §12 | High |
| INT-002 | Tax-rule MCP: seeded rate/bracket/due-date reference, versioned per tax year, federal + a small state set | PRD §12 | High — **which states is an open question** (PRD §23) |
| INT-003 | Expected-income MCP: manual invoice/expected-income entries (`list_expected_income`, `mark_invoice_late`) | PRD §12 | High |
| INT-004 | Custom Financial State + Priority Engine MCP: `get_state`, `set_goal`, `compute_allocation`, `classify_transaction`, `record_correction`, `get_projections` | PRD §12 | High |
| INT-005 | Clerk authentication integration, gating the deployed app | PRD §8 Bar 6, §16 | High |
| INT-006 | Langfuse tracing integration on every agentic loop, including interpreter confidence | PRD §8 Bar 7, §16 | High |
| INT-007 | Email delivery mechanism (unresolved: program-provided vs. third-party) | PRD §23 | Low — explicitly an open question |

### 4.7 Reporting and analytics requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| REP-001 | Interactive dashboard (number, allocation, runway, tax-bomb status) | PRD §11.6 (FR-22) | High |
| REP-002 | PDF cashflow & tax plan, on demand | PRD §11.6 (FR-23) | High |
| REP-003 | Email "the catch" alert | PRD §11.6 (FR-24) | High |
| REP-004 | Langfuse trace of the full re-plan loop visible/demonstrable | PRD §8 Bar 7 | High |
| REP-005 | No aggregate product analytics (activation, retention, engagement dashboards) are specified anywhere | *absence noted across all docs* | N/A — see GAP-014 |

### 4.8 Security requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| SEC-001 | Aggregator access tokens encrypted at rest, never exposed to the frontend | PRD §16 | High |
| SEC-002 | Clerk-gated access to the deployed app | PRD §16, §8 | High |
| SEC-003 | No real PII on stage; demo runs on scripted data | PRD §16 | High |
| SEC-004 | Demo-grade security posture only; explicitly **not** SOC 2 / a full security program for v1 | PRD §6, §19 | High (explicit non-goal) |
| SEC-005 | Spend/cost ceiling enforced per agentic run | PRD §8 Bar 7, §16 | High |

### 4.9 Privacy requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| PRIV-001 | Read + recommend only — the system never moves money, files, or gives advice | README.md, onepager.md, PRD §15 | High |
| PRIV-002 | Users expect "no credential storage," encryption, and "you never move my money" as trust conditions | personas.md ("Data-access concerns") | Low — explicitly tagged **[Assumption → validate]** in the source; also not fully reconciled with SEC-001's "tokens encrypted at rest" (tokens *are* stored, just encrypted) — see gap GAP-009 |
| PRIV-003 | A commingled account means the product sees personal spending too — flagged in-source as "a real privacy sensitivity to test" | personas.md | Medium — acknowledged risk, not yet a concrete requirement (e.g., no data-minimization or redaction rule specified) |

### 4.10 Compliance and regulatory requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| COMP-001 | NFA ("not financial advice") disclaimer required on every surfaced figure; "confirm with your accountant" | PRD §15, onepager.md | High |
| COMP-002 | Counsel review of the disclaimer scheduled **before** the tax engine is trusted for real users | onepager.md, PRD §15 | High — **no owner or date attached**; see GAP-002 |
| COMP-003 | Schedule C only; signup gated on filing structure | PRD §4, personas.md | High |
| COMP-004 | Tax math must be validated against real filed Schedule C returns before being trusted for real users ("Validate before automating" gate) | PRD §19 | High — **no schedule/owner attached**; see GAP-003 |
| COMP-005 | Classifier precision/recall must be validated on real anonymized commingled statements before automating "the catch" for real users | PRD §19 | High — same caveat |

### 4.11 Audit and logging requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| AUD-001 | Every agentic run produces a Langfuse trace, including each interpreter call's confidence | PRD §16, §8 Bar 7 | High |
| AUD-002 | Every `PLAN` is fully auditable via `PLAN_INPUT_*` lineage tables plus `input_digest`/`output_digest` | data-model.md | High |
| AUD-003 | Agent runs support retry tracking via `AGENT_RUN_ATTEMPT` | data-model.md | High |
| AUD-004 | `TRANSACTION_CLASSIFICATION` retains full history via `supersedes_id` chaining rather than mutation | data-model.md | High |

### 4.12 Operational requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| OPS-001 | Spend ceiling enforced per run; model calls capped | PRD §16, §8 Bar 7 | High |
| OPS-002 | Stale/broken feed detection: flag rather than silently going wrong | PRD §15 | High |
| OPS-003 | Demo runs deterministically off scripted data; no dependence on a live bank OAuth flow on stage | PRD §16 | High |
| OPS-004 | No support/incident-response process is documented for a real (non-demo) user | *absence* | N/A — see GAP-013 |

### 4.13 Migration or onboarding requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| ONB-001 | Connect bank account(s); backfill up to 24 months of transactions | PRD §6, FR-1, FR-27 | High |
| ONB-002 | Seed pass proposes detected income/cadence/categories from backfill for user confirmation | PRD FR-2 | High |
| ONB-003 | Goal configuration with defaults proposed from data, user-editable | PRD FR-3 | High |
| ONB-004 | No path is documented for importing a user's *existing* spreadsheet or QuickBooks Solopreneur data, even though personas.md describes exactly that as the primary persona's current workflow | *absence, cf. personas.md "Current workflow"* | Low — see GAP-015 |

### 4.14 Non-functional requirements

| ID | Statement | Source | Confidence |
|---|---|---|---|
| NFR-001 | Financial arithmetic must be exactly reproducible — no model-computed figures | PRD §9, §10, ai-agents.md (repeated) | High |
| NFR-002 | Cost/spend ceiling per agent run | PRD §8 Bar 7 | High |
| NFR-003 | Demo reliability: deterministic, scripted-data-driven, no live OAuth dependency | PRD §16 | High |
| NFR-004 | No performance, availability, scalability, or disaster-recovery targets are defined anywhere for a post-demo/production system | *absence* | N/A — see GAP-016, one of the weakest areas of the doc set |

---

## 5. Persona analysis

| Dimension | Primary — "lumpy-income solo pro" (Dev) | Secondary A — "steady-retainer solo" (Maya) | Secondary B — "windfall-prone consultant" (Sam) |
|---|---|---|---|
| **Goals** | Know the safe pay number now, forward-looking, without weekly re-math | Confirm on-track / funding order | Avoid treating a windfall as a raise |
| **Responsibilities** | Runs own business + personal money through one account, alone | Same, income closer to fixed | Same, income episodic and lumpy |
| **Pain points** | Allocation collapse under irregular income; tax-bomb dread | Milder — closer to solved by existing budgeting tools | Post-windfall over-spend/crash risk |
| **Permissions** | Read-only bank connection; confirms/corrects classifications | Same | Same |
| **Data access needs** | Full transaction history (24-mo backfill), balances, expected income | Same | Same |
| **Primary actions** | Connect bank, confirm low-confidence deposits, respond to "the catch," view number | Check in periodically, confirm on-track | Confirm windfall smoothing, review revised number |
| **Expected workflow** | Journey A (first session/catch) → Journey B (re-plan) | Journey C (quiet day) is the *typical* experience, per personas.md's own framing as "the demo's on-track contrast" | Journey B triggered by a large deposit event |
| **Exceptional/failure scenarios documented** | "Wrong number" (fatal), nagging on non-issues, feeling like a dashboard, scary bank-connection moment | "Sees it as redundant with a budgeting app" (churn risk) | "If it ever treats a windfall as recurring — that single error ends trust" |
| **Conflicts with other personas** | None documented — segmentation is by income shape, not competing permissions; all three share one engine (personas.md "Segmentation logic") | none | none |
| **Missing information** | No confirmed *frequency* data (P1 untested); no real workflow observation, only assumed | No named triggering cadence beyond "annual/seasonal charges"; thin | Population size and buying trigger explicitly called "smaller...episodic" but not quantified |

**Coverage assessment against the requested role list:**

| Role | Covered? | Evidence |
|---|---|---|
| End users | **Yes** — 1 primary + 2 secondary | personas.md |
| Internal operations (support/ops) | **No** | Not mentioned anywhere |
| Administrators | **No** | No admin role, no admin console, no user-management flow described |
| Support teams | **No** | Not mentioned; see GAP-013 |
| Compliance teams | **Implied, not modeled** | "Counsel review" is referenced (PRD §15) but counsel/compliance is never named as an actor with responsibilities, timeline, or access |
| Risk teams | **No** | Not mentioned |
| Auditors | **Partially, as a capability not a persona** | The data model is built for auditability (lineage tables), but no human "auditor" actor or workflow is described |
| Approvers | **N/A for v1** (no money movement) | Anticipated for v3 "Act" (BaaS partner, approval-gated execution) but not designed yet |
| Integration partners | **Named as systems, not actors** | Aggregator (Plaid/Teller), future BaaS partner — referenced as vendors, no partner-facing persona/workflow |
| System actors | **Yes, well-specified** | Orchestrating Agent, Priority Engine, 6 skills — ai-agents.md is thorough here |

**Proposed personas (not in source docs — flagged as such per instructions):**
- *Proposed:* "Program/Demo evaluator" — the person(s) who score the 7 acceptance bars; effectively a persona for the whole PRD's acceptance-criteria section, never named as one.
- *Proposed:* "Accountant/bookkeeper referral partner" — implied by hypothesis D1 but never given goals/workflow/permissions as an actor who might eventually get a product surface.

---

## 6. User journey and workflow analysis

Three flows are documented in PRD §13, matched to the trigger model in §14 and the demo script
in §18:

| Flow | Steps (as documented) | Coverage |
|---|---|---|
| **A. First session ("the catch")** | Connect → 24-mo backfill → seed pass (propose income/cadence/categories) → user confirms low-confidence deposits → engine computes → "the catch" opens → user reviews full plan | Golden path only. No documented failure branch for: backfill returning too little history, aggregator connection failure, or a user who confirms *no* deposits are income (empty state) |
| **B. Re-plan** | Trigger fires → agent interprets → classifies unclear deposit if any → engine recomputes → one decision surfaces + one-line explanation → email if consequential | Three trigger sub-cases documented (schedule/source-event/manual); no documented behavior for *conflicting* simultaneous triggers beyond ai-agents.md's evaluation case "(c) two simultaneous issues → surfaces the higher-consequence one only" |
| **C. Quiet day** | Scheduled run finds nothing material → no interruption; dashboard reflects latest plan if opened | Well-specified as the "earned attention" default state |

**Exception/failure flows that *are* documented (scattered across PRD §15, ai-agents.md eval
cases):**
- Stale/broken feed → flagged, not silently wrong (PRD §15).
- Infeasible month (income too low to fund pay) → taxes/runway funded first, pay/savings
  reported short, never silently wrong (Synthesizer eval 2).
- Ambiguous user message ("things are tight") → agent asks a clarifying question rather than
  guessing (ai-agents.md, Orchestrator eval case d).
- Required fields missing at alert-composition time → Alert Composer fails closed, sends
  nothing (ai-agents.md, Component 6 guardrails).

**Exception/failure flows that are *not* documented:**
- What happens if the user disconnects their bank mid-cycle, or revokes aggregator access.
- What happens on account closure / user deletion (no data-deletion flow at all — see
  GAP-011).
- What the user sees if the Financial State engine or an MCP source is down when a decision is
  due (only "stale/broken feed" is covered for the *aggregator* specifically, not for the
  tax-rule or expected-income sources).
- Onboarding when the user is *not* Schedule C (only "signup must gate on filing structure" is
  stated — no described UX for what a gated-out user experiences).
- Multi-account / multiple commingled accounts for one user (schema supports `BANK_ACCOUNT ⇄
  BANK_CONNECTION` one-to-many, but no functional requirement addresses how the engine
  aggregates or whether it must — see GAP-006).

**Reconciliation with the trigger model (PRD §14):** all four trigger types (schedule,
source-event, manual feedback, threshold) map cleanly onto `TRIGGER_EVENT.trigger_type` in the
ERD (`schedule|source_event|manual_feedback|threshold`) — this is a rare example of full,
literal consistency between the PRD's prose and the ERD's enum values.

---

## 7. ERD and data model analysis

**Core entities (24, grouped per data-model.md's own "Domain groupings" table):** Identity &
config (`USER`, `GOAL_CONFIG`, `BUCKET_TARGET`, `TAX_PROFILE`); Bank data raw
(`BANK_CONNECTION`, `BANK_ACCOUNT`, `TRANSACTION`, `ACCOUNT_BALANCE_SNAPSHOT`); Interpretation
(`TRANSACTION_CLASSIFICATION`, `RECURRING_EXPENSE`/`_VERSION`/`_TXN`,
`EXPECTED_INCOME`/`_VERSION`); Tax reference (`TAX_RULE_SET`, `TAX_BRACKET`, `TAX_DUE_DATE`);
Orchestration (`TRIGGER_EVENT`, `AGENT_RUN`, `AGENT_RUN_ATTEMPT`); Plan output (`PLAN`,
`ALLOCATION_LINE`, `PROJECTION`, `PLAN_WARNING`); Lineage (`PLAN_INPUT_*`, 5 join tables);
Feedback loop (`CHECK_IN`, `RECOMMENDATION_OUTCOME`).

**Relationships & cardinality:** Consistently modeled as one-to-many from owning entities down
to detail rows (e.g., `USER ||--o{ PLAN`, `PLAN ||--o{ ALLOCATION_LINE`), with two notable
optional/one relationships: `TRANSACTION |o--o| EXPECTED_INCOME_VERSION : settles` (a
transaction *may* settle an expected-income record) and `PLAN ||--o| RECOMMENDATION_OUTCOME`
(a plan may or may not have an observed outcome). `CHECK_IN |o--o| TRANSACTION_CLASSIFICATION`
correctly models that a check-in response *may* create a new user classification but doesn't
have to.

**Ownership / source of truth:** Clearly delineated — bank data (`TRANSACTION`,
`ACCOUNT_BALANCE_SNAPSHOT`) is immutable aggregator ground truth; `TRANSACTION_CLASSIFICATION`
is the interpreted layer (unifying seed/model/user sources); `PLAN` + its children are the
computed system of record for what the engine decided; `TAX_RULE_SET`/`TAX_BRACKET`/
`TAX_DUE_DATE` are versioned reference data with citations. This is a genuinely strong,
audit-ready design.

**Required identifiers:** All entities use `uuid id PK`; natural/business keys are modeled
separately where they matter (`TRIGGER_EVENT.idempotency_key "unique"`,
`RECURRING_EXPENSE.merchant "identity"`, `EXPECTED_INCOME.invoice_ref "identity"`) — good
practice for idempotent trigger handling and versioned-entity identity.

**Status / lifecycle fields:** Present and enumerated for most mutable entities
(`BANK_CONNECTION.status`, `PLAN.plan_status`, `ALLOCATION_LINE.funded_status`,
`EXPECTED_INCOME_VERSION.status`, `RECURRING_EXPENSE_VERSION.status`,
`TRANSACTION_CLASSIFICATION.review_state`, `AGENT_RUN.status`). No lifecycle/status field
exists on `USER` itself beyond `v1_eligibility` (see ambiguity below).

**Audit fields:** `created_at`/`ingested_at`/`effective_from` are present throughout; there is
**no `updated_at` or `deleted_at`** anywhere. This is *consistent by design* with the
append-only/versioning pattern (updates create new rows, they don't mutate) — not a defect,
but it also means **no soft-delete or retention mechanism exists at all** (see GAP-011).

**PII / financial / sensitive data:** `USER.email`, `TRANSACTION.raw_description` +
`.counterparty` (third-party PII in memo/counterparty strings), and the entire commingled
`BANK_ACCOUNT` feed (personal spending, per `is_commingled`) are all sensitive. **No field
anywhere flags data classification, consent, or retention** — see GAP-010, GAP-011.

**Referential integrity expectations:** Documented implicitly through FK arrows and the
`is_current`/`supersedes_id` pattern; no explicit statement of cascade/delete behavior,
uniqueness constraints beyond the "partial-unique" notes, or how `PLAN_INPUT_*` rows behave if
a referenced classification/version is later superseded (does the historical plan's lineage
stay pinned to the old version? The prose strongly implies yes — "pin the specific versions...
that fed each plan" — but it's not stated as an explicit invariant/constraint).

**Retention & deletion:** Not addressed anywhere in the schema or the PRD. Given the product
handles bank transactions and tax data, this is a real gap before any real-user pilot (see
GAP-011, COMP risk R-003).

**Comparison against PRD/personas/onepager — flagged discrepancies:**

| Issue | Documented capability | Supporting data model | Severity |
|---|---|---|---|
| Correction log | PRD §12 lists `Correction (user label/override — the correction log)` as a distinct key entity; ai-agents.md refers to `record_correction` and "the correction log" as durable memory repeatedly | No `CORRECTION` table in the ERD; implemented (by interpretation) via `TRANSACTION_CLASSIFICATION(source=user, supersedes_id)` + `CHECK_IN.resulting_classification_id` | **Medium** — plausible as an intentional modeling refinement, but undocumented as such; an engineer building `record_correction` from `data-model.md` alone would not see the mapping |
| Category entity | PRD §12 lists `Category (txn → fixed/variable)` as a standalone entity | Folded into `TRANSACTION_CLASSIFICATION.label` enum values (`fixed_recurring`, `variable_discretionary`) | Low — cosmetic drift |
| SpendForecast entity | PRD §12 lists `SpendForecast (predicted next-period spend, range + assumption)` as standalone | Folded into `PROJECTION.kind = 'spend'` | Low — cosmetic drift |
| Feasibility report | FR-14 requires a "feasibility report" in the Synthesizer's output | No dedicated entity; presumably derived at read-time from `PLAN.plan_status` + `ALLOCATION_LINE.funded_status` + `PLAN_WARNING` | Low — likely a derived/computed view, not stored state, but not stated as such |
| `is_commingled` ambiguity | The entire product thesis rests on the commingled-account problem (README, onepager, PRD §3) | `BANK_ACCOUNT.is_commingled bool` — no field or rule states who sets it, when, or what a `false` value implies for the product's core logic | **Medium** — a central business concept has an underspecified data field |
| `USER.v1_eligibility` ambiguity | PRD §4 requires signup to gate on filing structure | Enum documented with exactly one value, `schedule_c_supported`, annotated "(gate only, non-authoritative)" — the full value set (e.g., an ineligible/pending state) isn't specified | Low-Medium |
| Consent / notification preference | PRD §11.6 (email output), open question on email delivery mechanism (§23) | No consent, opt-in, or notification-preference field anywhere on `USER` | Medium — relevant to both UX and privacy/compliance |
| Billing / subscription | Hypothesis C1 discusses a $15–30/mo real-money commit test | No billing/subscription/payment entity anywhere | Low for v1 (explicitly out of scope), but should be flagged before C1 is actually run |

**Modeling note (not a contradiction, a recommendation for Pass 2):** `TRANSACTION_CLASSIFICATION.label`
mixes deposit-side and outflow-side vocabularies in one enum. Splitting into a `direction`
discriminator plus two label sets (or two enums) would make invalid combinations (e.g., an
outflow labeled `income`) unrepresentable — worth a design note, not a redesign, at this stage.

---

## 8. Contradiction log

| ID | Topic | Source A | Source B | Conflict | Impact | Recommended resolution | Stakeholders | Severity |
|---|---|---|---|---|---|---|---|---|
| C-001 | Companion-doc versioning | PRD-v2.md, line 6 (companion docs: **"v3 Brief"**) | docs/onepager.md, line 3 (header: **"v2"**) | PRD's companion-doc line implies a "v3 Brief" distinct from the one-pager; only one exec-brief doc exists and it's labeled v2 | Low direct impact, but signals doc-versioning isn't tightly controlled — risk of someone looking for a "v3" doc that doesn't exist | Fix the PRD line to read "Executive Brief (v2)" or confirm/create the missing v3 brief | Product/doc owner | Low |
| C-002 | Missing predecessor document | PRD-v2.md, line 5 ("Supersedes: PRD v1.0, 2026-06-27") | Repository contents / `git log --all` (no v1 file, ever) | A cited predecessor document cannot be located anywhere in the repo | Can't audit what specifically changed beyond the PRD's self-reported summary table | Confirm whether v1 lived outside this repo, and if it should be added for history/audit | Product owner | Low |
| C-003 | Validation-first plan vs. build-first schedule | docs/hypotheses.md, "What this means for the capstone" (recommends running P1–P3 + A1 *before* Demo Day as the cheapest existential tests) | docs/PRD-v2.md §21 Milestones (W1–W8; no interview/validation task appears in any week) | The validation doc's own recommended sequence isn't reflected in the build's week-by-week plan | The entire architecture and 8-week schedule may be built on top of an unvalidated core assumption (owner-pay uncertainty frequency/severity, classifier feasibility) | Explicitly slot P1–P3 interviews and the A1 classifier-accuracy test into the milestone table, even as a parallel, non-blocking track, and decide a demo-day fallback if they fail | Product owner, capstone program advisors | **High** |
| C-004 | "Correction log" named entity vs. ERD implementation | docs/PRD-v2.md §12, docs/ai-agents.md (repeated) — treats "the correction log" as a distinct, named concept/entity | docs/data-model.md — no `CORRECTION` table; concept is implicit in `TRANSACTION_CLASSIFICATION(source=user)` + `CHECK_IN` | An engineer reading only the ERD would not know how `record_correction` (an explicitly named MCP tool, PRD §12) is meant to persist data | Implementation ambiguity for a trust-critical mechanism (corrections are described as "the safety mechanism") | Add an explicit note (or a table) in data-model.md reconciling "correction log" terminology with its ERD implementation | Engineering, Product | Medium |
| C-005 | Trust messaging vs. technical design on token storage | docs/personas.md, "Data-access concerns" (user expectation: "no credential storage") | docs/PRD-v2.md §16 ("access tokens encrypted at rest") | Persona-level trust copy implies no credentials are stored; the actual design stores encrypted access tokens (standard for Plaid/Teller-style OAuth, but not literally "no storage") | Could produce misleading trust copy in the product UI if not reconciled | Clarify user-facing language to distinguish "we never see/store your bank password" (true) from "we store an encrypted access token to sync your data" (also true) — these aren't contradictory in substance, but the persona doc's phrasing invites the reader to think they are | Product, Security | Medium |
| C-006 | Entity naming drift (Category, SpendForecast) | docs/PRD-v2.md §12 (lists `Category`, `SpendForecast` as standalone entities) | docs/data-model.md (folds both into other entities/enums) | Terminology inconsistency between the requirements doc and the ERD | Low — no functional ambiguity, just doc hygiene | Update PRD §12's entity list to match the ERD, or add a mapping note | Product, Engineering | Low |

No **Critical**-severity contradictions were found — nothing here directly and immediately
blocks Demo Day engineering work; the highest-severity item (C-003) is a business/validation
risk rather than a build blocker for the scripted-demo scope.

---

## 9. Requirements gap analysis

| ID | Missing information | Why it's needed | Impact if unresolved | Owner | Blocking? | Severity | Suggested stakeholder question |
|---|---|---|---|---|---|---|---|
| GAP-001 | No scheduled date/owner for the P1–P3 interviews or the A1 classifier-accuracy test | hypotheses.md itself calls these the cheapest, most existential tests — the whole PRD's premise depends on them | Demo Day (and any post-capstone continuation) proceeds without evidence the wedge is real | Product owner | **Blocking** (for the business thesis, not for the scripted demo itself) | Critical | "What is the concrete date and owner for running P1–P3 interviews and the A1 classifier test before or in parallel with the build?" |
| GAP-002 | No owner/date for counsel review of the NFA disclaimer | PRD §15 names this as a prerequisite gate before the tax engine is "trusted for real users" | Any move from scripted demo to a real pilot user is legally exposed | Legal/Compliance | **Blocking** (before any real-user exposure) | High | "Who is engaging counsel, and by when, to review the NFA disclaimer language?" |
| GAP-003 | No plan/date for validating tax math against real filed Schedule C returns | PRD §19 "Validate before automating" gate | Tax figures could be materially wrong for any real user relying on them | Product / Tax SME | **Blocking** (before real users) | High | "What real filed-return dataset will be used to validate the tax engine, and when?" |
| GAP-004 | Aggregator choice (Plaid vs. Teller) undecided | PRD §23 open question; blocks the "real-data proof track" | Engineering can't finalize the aggregator MCP beyond the scripted-data path | Engineering / Architecture | Non-blocking for the scripted demo; **blocking** for the real-data track | Medium | "Plaid or Teller for the real-data proof — what's the decision date and criteria?" |
| GAP-005 | Exact tax-rule seed state list (which 1–3 states beyond federal) undecided | PRD §23 open question; W2 milestone requires the tax-rule MCP seeded | Engineering can't finish seeding the Tax-rule MCP without this | Product / Engineering | **Blocking** (already past its W2 milestone date as of today, 2026-07-16, which falls in W4) | High | "Which states are in scope for the v1 tax-rule seed — is CA (the canonical persona's state) sufficient, or do we need 1–2 more?" |
| GAP-006 | No functional requirement addresses multiple bank accounts/connections per user | ERD supports `USER ||--o{ BANK_CONNECTION` and `BANK_CONNECTION ||--o{ BANK_ACCOUNT`, implying multi-account is structurally possible, but no FR describes how allocation aggregates across accounts | Ambiguous behavior if a demo or real user connects more than one account | Product / Engineering | Non-blocking for the single-account canonical demo | Medium | "Is multi-account support in scope for v1, even structurally, or should the schema explicitly constrain to one account per user for now?" |
| GAP-007 | No consent / notification-preference model | Email is a required output (FR-24); no opt-in/consent field exists on `USER` | Can't reason about compliance for unsolicited email, or user preference for channel (email vs. UI-only) | Product / Legal | Non-blocking for demo (single scripted persona) | Medium | "Do users need to explicitly opt in to email alerts, and where should that preference live?" |
| GAP-008 | `BANK_ACCOUNT.is_commingled` — no rule for who sets it or what `false` implies | The commingled-account problem is the product's core differentiator | Ambiguous onboarding/engine behavior if the flag isn't reliably set | Engineering | Non-blocking for demo (persona is commingled by construction) | Medium | "Is `is_commingled` self-reported at onboarding, inferred from transaction patterns, or defaulted to true for all v1 accounts?" |
| GAP-009 | Reconciliation of "no credential storage" trust copy vs. encrypted-token-storage reality | See contradiction C-005 | Risk of user-facing copy that reads as an overpromise | Product / Security | Non-blocking for demo | Low-Medium | "Can we finalize the exact trust-copy wording so it's accurate about what is/isn't stored?" |
| GAP-010 | No data classification / PII tagging on any entity | `TRANSACTION`, `USER`, counterparty strings all carry PII; no schema-level flag | Harder to build future compliance tooling (export, redaction, access control) on top of this schema later | Data / Security | Non-blocking for demo | Medium | "Should PII fields be tagged now (e.g., via column comments or a data dictionary) to ease future compliance work?" |
| GAP-011 | No retention or deletion (right-to-delete) model anywhere in the schema | Product will hold bank transactions, tax data, and PII | Before any real user, "delete my account" has no defined behavior, and there's no retention policy | Legal / Data / Engineering | **Blocking before real users**, non-blocking for demo | High | "What is the data retention and deletion policy for a real user who disconnects or requests deletion?" |
| GAP-012 | No aggregate product-level success metric (activation, retention, NPS) beyond per-hypothesis thresholds | Hypotheses define pass/fail thresholds per test, but no north-star metric ties them together | Hard to know, post-capstone, whether the product overall is "working" beyond the demo | Product | Non-blocking for demo | Low | "Beyond the individual hypothesis thresholds, what single metric will define post-capstone success?" |
| GAP-013 | No support/operations model for a real user | No persona, workflow, or tooling described for handling a user's account-connection issue, billing question, or trust concern | A real pilot would have no defined escalation path | Support/Ops (role currently undefined — see persona gap) | Non-blocking for demo | Medium | "Who handles a real user's support request, and through what channel, once outside the scripted demo?" |
| GAP-014 | No error-handling spec for MCP source outages beyond the aggregator ("stale/broken feed") | Tax-rule and expected-income MCP failure modes aren't addressed | Ambiguous system behavior if a non-aggregator source is unavailable | Engineering | Non-blocking for demo (scripted data can't "go down") | Low | "Should tax-rule/expected-income source outages be handled the same way as aggregator staleness, or differently?" |
| GAP-015 | No import path from a user's existing spreadsheet/QuickBooks Solopreneur history | personas.md's "Current workflow" describes exactly this as the primary persona's existing tool | Onboarding for a real (non-scripted) user starts from zero classification history, which may be a worse first-run experience than the docs assume | Product | Non-blocking for demo | Low | "Should v1 support any import of prior categorization/history, or is a cold-start backfill-only onboarding acceptable?" |
| GAP-016 | No performance, availability, scalability, or disaster-recovery targets for any post-demo/production use | Docs address demo-grade reliability only | No basis for capacity planning or SLAs once beyond a single scripted demo run | Engineering / Architecture | Non-blocking for demo | Medium | "Are there any non-functional targets (uptime, response time, concurrent users) planned for a post-capstone pilot?" |
| GAP-017 | No idempotency/reconciliation spec beyond `TRIGGER_EVENT.idempotency_key` | Webhook-driven triggers can duplicate; only a unique key is modeled, no described reconciliation behavior on duplicate delivery | Risk of double-processing a webhook in a real (non-scripted) deployment | Engineering | Non-blocking for demo | Low | "What is the intended behavior when a duplicate webhook/trigger event arrives — silently dedupe, or surface an error?" |
| GAP-018 | No environment/deployment strategy documented (dev/staging/prod, or how Claude Code dev invocation and the headless prod runner share config safely) | Bar 5 requires dual-invocation (Claude Code dev + headless prod runner) but no environment-separation or config-management requirement is stated | Risk of dev/test invocations touching the same state as the "prod" demo run | Engineering | Non-blocking for the single-environment demo | Low | "How are dev (Claude Code) and prod (headless runner) invocations of the Synthesizer kept from cross-contaminating state during development?" |
| GAP-019 | No testing-strategy document beyond the per-skill eval suites | Eval cases (14 core, +6 optional) cover skill behavior; no mention of integration testing, UI testing, or regression testing across the full stack | Risk that eval-green skills still fail when wired together for the live demo | Engineering | Non-blocking-but-important; the PRD does schedule "dry-run #1/#2/#3" (W7-W8) which partially covers this | Low-Medium | "Do the scheduled dry-runs (W7-W8) constitute the full test strategy, or is additional integration/UI testing planned?" |

**Summary:** 19 gaps identified; **6 flagged as blocking** (GAP-001, GAP-002, GAP-003, GAP-005,
GAP-011, and GAP-005's schedule slip makes it effectively already-due) for a real-user pilot or
an on-schedule build; the rest are non-blocking for the scripted Demo Day but should be
resolved before any real user or production deployment.

---

## 10. Assumptions register

*(Assumptions made by this analysis, not product assumptions — those are the hypotheses.md
content itself, already fully covered in §4 and cited throughout.)*

| ID | Assumption | Reason inferred | Supporting source | Risk if incorrect | Validation owner | Validation question |
|---|---|---|---|---|---|---|
| AS-001 | `docs/data-model.md`, though uncommitted, is intended as the current, authoritative data model (not a draft to be discarded) | README.md's own uncommitted diff already adds a link to it in the docs table, suggesting it's mid-integration, not abandoned | README.md diff (`git diff`), docs/data-model.md | Low — if wrong, this whole ERD analysis (§7) targets a document that isn't meant to ship | Product owner | "Is `docs/data-model.md` ready to commit as-is, or still a working draft?" |
| AS-002 | The repository (`README.md` + `docs/*.md`) is the complete relevant document set — no external wiki, Notion, Jira, or Figma holds additional requirements | No other doc references were found in any file; the repo is small and self-contained | Full-repo search (`git ls-files`, `find`) | Medium — if a program-provided spec (e.g., the capstone's official rubric) exists outside this repo, this analysis is missing it | Product owner | "Does the capstone program provide a rubric/spec document outside this repo that should be cross-checked against?" |
| AS-003 | "v3 Brief" in PRD-v2.md's companion-docs line is a stale/typo reference to the existing v2 one-pager, not evidence of a missing third document | No file, commit, or branch reference to any "v3" brief exists anywhere in git history | `git log --all`, `git ls-files` | Low — if wrong, an actual v3 document may be missing from the repo | Product owner (doc author) | "Was there ever a distinct 'v3 Brief,' or should the PRD line simply read 'Executive Brief (v2)'?" |
| AS-004 | As of 2026-07-16, no problem interviews (P1–P3) or classifier-accuracy test (A1) have actually been run — the personas.md "no interviews conducted" statement is still current | No interview notes, transcripts, or results files exist anywhere in the repo, and no doc has been updated since 2026-07-11 (5 days before this analysis) to reflect new findings | Absence of any results artifact in the repo; personas.md dated 2026-07-11 | Medium — interviews may have happened but not yet been written back into the docs | Product owner | "Have any of the P1–P3 interviews or the A1 classifier test already run since 2026-07-11? If so, where are the results recorded?" |
| AS-005 | `TRANSACTION_CLASSIFICATION(source='user')` combined with `CHECK_IN.resulting_classification_id` is the intended implementation of "the correction log" referenced in PRD §12 and ai-agents.md | This is the only mechanism in the ERD that stores a user-provided label distinct from seed/model labels, and `supersedes_id` gives it a history | docs/data-model.md ERD | Medium — if a separate `CORRECTION` entity was actually intended (e.g., to independently track override *reasons*, not just relabeling), the current schema under-serves that need | Engineering / Product | See stakeholder question under C-004 |
| AS-006 | The single Mermaid ERD in `data-model.md` is meant to represent the *entire* v1 schema (i.e., there is no additional schema documentation elsewhere not yet written) | No other schema files, migration scripts, or ORM models exist in the repo to cross-check against | Repo-wide file search | Low | Engineering | "Is `data-model.md`'s ERD the full v1 schema, or are there entities (e.g., billing, notification preferences) intentionally deferred to a later doc?" |

---

## 11. Risk and dependency register

| ID | Description | Category | Source/reason | Potential impact | Likelihood | Severity | Mitigation / next action | Owner |
|---|---|---|---|---|---|---|---|---|
| R-001 | NFA disclaimer hasn't been reviewed by counsel; demo will still show computed tax figures on stage | Regulatory/Legal | PRD §15, GAP-002 | Legal exposure once any non-scripted/real-data use begins | Low (demo is scripted) / Medium (post-demo) | High | Schedule counsel review before any real-data pilot; keep demo strictly scripted until then | Legal/Compliance, Product |
| R-002 | No formal security program; explicitly demo-grade only | Security | PRD §6, §19 | Acceptable for a scripted demo; unacceptable if real bank data or PII is ever processed without upgrading posture | Low now / High later | Medium | Define the security roadmap gate before any real-data pilot (SOC2 or equivalent scoping) | Engineering/Security |
| R-003 | Commingled account exposure (personal spending visible) with no retention/consent model | Privacy/Data | personas.md, GAP-010/011 | Regulatory and trust risk if real users connect | Medium (as soon as real data is used) | High | Add retention/consent/deletion design before any real pilot | Product/Legal |
| R-004 | Core business hypotheses (P1, P2, A1, T1, B1, C1) are untested as of this analysis | Requirement ambiguity / existential business risk | hypotheses.md, C-003 | Building 8 weeks toward a wedge that interviews could kill cheaply first | Medium-High | **Critical** (per the doc's own framing) | Run P1–P3 interviews and A1 classifier test in parallel with the build, per hypotheses.md's own recommendation | Product owner |
| R-005 | Aggregator vendor (Plaid vs. Teller) undecided for the real-data track | Vendor/Integration | PRD §23 | Delays the "real-data proof" parallel track; doesn't block the scripted demo | Medium | Low (non-blocking for Demo Day) | Decide vendor based on speed-to-integrate vs. production readiness tradeoff already named in the PRD | Engineering |
| R-006 | Classifier precision/recall on real (non-scripted) commingled data is unproven — only scripted eval cases exist | Architecture/AI risk | PRD §19, §10 (falsifiability check) | The single highest product risk per the doc's own framing: if the classifier can't hit a safe accuracy bar, the number is unsafe to automate | Unknown (untested) | **Critical** (existential per hypotheses.md's own A1 framing) | Prioritize A1 (classifier accuracy test on real anonymized statements) — doesn't need live users | Engineering/Data |
| R-007 | Fixed 8-week program schedule with a hard Demo Day date; PRD's own cut-order shows planned fragility (Materiality/Alert Composer already provisional) | Delivery | PRD §20, §21 | Late slips cascade into cutting trust-enhancing (but non-blocking) features first | Medium | Medium | Milestones already define a cut order; re-confirm it's still current given today (2026-07-16) sits in W4 | Program/Product |
| R-008 | Program-provided infrastructure (Clerk, Langfuse, deploy) is an external dependency this doc set doesn't control | External/cross-team dependency | PRD §20 | A slip here blocks Bars 6 and 7 regardless of this team's own progress | Medium | Medium | Front-load W5/W7 per the PRD's own plan; confirm program infra status now (mid-W4) | Program administrators |
| R-009 | Tax math unvalidated against real filed Schedule C returns | Data/Compliance | PRD §19, GAP-003 | A materially wrong tax figure is the single most trust-destroying failure mode named repeatedly across the docs | Unknown (untested) | High | Source anonymized real returns for validation; schedule before any real-user trust claim | Product/Tax SME |
| R-010 | Documentation-integrity drift (missing PRD v1, "v3 Brief" reference, entity-naming drift) | Documentation integrity | C-001, C-002, C-006 | Low direct product risk, but erodes confidence in the doc set's reliability as the project scales past one owner | Low | Low | Light doc cleanup pass; not urgent | Product/doc owner |

---

## 12. Documentation readiness scorecard

| Area | Score (1–5) | Why | Evidence | To improve |
|---|---|---|---|---|
| Business clarity | **5** | Problem, vision, objective, and differentiation are stated once and repeated consistently, word-for-word in places, across all 7 docs | README.md, onepager.md, PRD §1–3 all state the same hero output and problem framing verbatim | Nothing structural; keep it this tight as the doc set grows |
| Scope clarity | **5** | Explicit in/out-of-scope tables appear in 3 separate docs and agree with each other | PRD §6, personas.md "out of scope" table, onepager.md "MVP scope" | Nothing structural |
| Persona completeness | **3** | End-user personas are unusually rigorous (evidence-tagged); internal roles (support/compliance/risk/admin/auditor) are entirely absent | personas.md; §5 of this analysis | Add at minimum a "who reviews the disclaimer" and "who supports a real user" actor, even if lightly specified |
| Workflow completeness | **4** | Golden path (3 flows) and several exception cases are explicit and specific; several real-world exception flows (disconnect, deletion, multi-account, non-aggregator outage) are not covered | PRD §13–14, ai-agents.md eval cases; §6 of this analysis | Add exception-flow coverage for account disconnection/deletion and non-aggregator source outages before real users |
| Functional requirement completeness | **4** | FR-1…FR-30, each mapped to an acceptance bar and at least one eval case | PRD §11, §17 | Reconcile the "correction log" and entity-naming drift against the ERD (C-004, C-006) |
| Data model completeness | **4** | Versioning, lineage, and audit design are unusually strong for this stage; gaps are in consent/retention/billing and a few ambiguous fields | data-model.md; §7 of this analysis | Add retention/consent fields; reconcile correction-log and is_commingled ambiguity |
| Integration clarity | **3** | 4 MCP sources are named with concrete tool signatures; but the aggregator vendor and email delivery mechanism are both open | PRD §9, §12, §23 | Resolve the two open integration decisions (GAP-004, aggregator; email mechanism) |
| Security and compliance coverage | **3** | Demo-grade posture is explicit and honestly scoped as *not* production-ready; but the two "before real users" gates (counsel review, tax-math validation) have no owner or date | PRD §15, §16, §19 | Assign owners/dates to COMP-002/COMP-004/COMP-005 |
| Non-functional requirement coverage | **2** | Only cost ceiling and demo-determinism are specified; no performance, availability, scalability, or DR targets exist for any post-demo use | PRD §16; absence noted in §4.14 | Define even placeholder NFR targets for a first real pilot, distinct from the demo-only reliability requirement |
| Testability | **4** | 14 core (+6 optional) skill-level eval cases with concrete inputs/expected outputs; 7 acceptance bars each with a named proof artifact | PRD §17, §8 | Add an explicit integration/UI test plan beyond the scheduled dry-runs (GAP-019) |
| Traceability | **4** | FR IDs trace cleanly to acceptance bars and eval cases; data lineage is unusually strong; a few entities (correction log) don't trace cleanly between PRD and ERD | PRD §8, §11, §17; data-model.md | Close the correction-log and entity-naming gaps (C-004, C-006) |
| **Overall readiness for solution design** | **4 — Mostly ready** | Architecture, requirements, and data model are unusually mature for this stage of a project; remaining gaps are reconciliation items, not missing decisions | Synthesis of §4, §7, §8 | Resolve the Medium-severity contradictions (C-004, C-005) and the two Blocking-before-build gaps (GAP-005 tax-state list, which is already past its own milestone date) |
| **Overall readiness for backlog creation** | **3 — Partially sufficient** | FRs are concrete enough to seed a capstone backlog today; but real validation evidence, NFR targets, and several "before real users" gates are unresolved, which matters if the backlog is meant to extend past the scripted demo | Synthesis of §9, §11 | Prioritize closing the 6 blocking gaps in §9 before treating this as a backlog ready for anything beyond the scripted Demo Day build |

---

## 13. Prioritized stakeholder questions

**P0 — must be resolved before solution design**

| # | Stakeholder | Question |
|---|---|---|
| 1 | Product | Given hypotheses.md ranks P1–P3 (interviews) and A1 (classifier accuracy) as the cheapest existential tests, and none have run as of 2026-07-16, what is the concrete date/owner for running them — and what happens to the build plan if P1 fails? |
| 2 | Engineering | Which 1–3 states (beyond federal) are in the v1 tax-rule seed? This was a W2 milestone dependency and today (2026-07-16) is already in W4. |
| 3 | Compliance/Legal | Who is engaging counsel to review the NFA disclaimer, and by what date — is this achievable before Demo Day, or explicitly deferred past it? |
| 4 | Risk | If A1 (classifier accuracy) or tax-math-vs-real-returns validation isn't complete by Demo Day, does that change what can honestly be claimed live (i.e., is showing a computed tax figure on stage without either validation a go/no-go issue)? |
| 5 | Architecture | Is `TRANSACTION_CLASSIFICATION(source=user)` + `CHECK_IN` the intended full implementation of "the correction log" named in the PRD and ai-agents.md, or is a distinct `CORRECTION` entity still expected? |
| 6 | Engineering | Plaid or Teller for the real-data proof track — what's the decision date and criteria (PRD §23 leaves this open)? |
| 7 | Product | Is `docs/data-model.md` (currently uncommitted) ready to be treated as the authoritative v1 schema, or still a draft? |
| 8 | Engineering | What determines `BANK_ACCOUNT.is_commingled` — self-report at onboarding, inference, or a hardcoded `true` for all v1 accounts? |
| 9 | Legal/Data | What is the retention and deletion policy for bank transaction and tax data, given none is currently modeled — is this required before Demo Day or deferrable to any real pilot? |

**P1 — must be resolved before backlog finalization**

| # | Stakeholder | Question |
|---|---|---|
| 10 | Business operations | Who owns the pricing decision ($15–30/mo band, hypothesis C1), and when is the real-commit test run relative to Demo Day? |
| 11 | Engineering | What email delivery mechanism (program-provided vs. third-party) will be used to build FR-24? |
| 12 | Security | What is the target security posture and timeline once demo-grade is no longer sufficient? |
| 13 | Security | How are aggregator access tokens actually stored/rotated/revoked (KMS, secret manager) beyond "encrypted at rest"? |
| 14 | Data | Should retention/deletion and PII-classification fields be added to the schema now, ahead of any real pilot, or is that explicitly a later phase? |
| 15 | Product | Should users see a distinct message/experience when they're gated out at signup for not being Schedule C (PRD requires the gate; no UX for it is described)? |
| 16 | Support/Ops | Who handles a real user's support request (bank-connection failure, billing question, trust concern), given no support persona or workflow exists? |
| 17 | Product | Is multi-bank-account support in scope for v1 even structurally, given the schema already allows it but no FR addresses allocation across multiple accounts? |

**P2 — can be resolved during refinement**

| # | Stakeholder | Question |
|---|---|---|
| 18 | Product | Is there a plan for an accountant-facing surface, given hypothesis D1 treats accountants as a distribution channel but no product surface or persona is defined for them? |
| 19 | Data | Should a data-classification/PII tag be added to relevant columns now to ease future compliance tooling? |
| 20 | Engineering | Should tax-rule/expected-income MCP outages be handled the same way as aggregator staleness, or differently? |
| 21 | Product | Should v1 support importing a user's existing spreadsheet/QuickBooks history, given that's the documented primary-persona status quo? |
| 22 | Engineering | What is the intended behavior on a duplicate webhook/trigger delivery beyond the `idempotency_key` uniqueness constraint? |
| 23 | Architecture | How are dev (Claude Code) and prod (headless runner) invocations of the Synthesizer kept from cross-contaminating state during development? |
| 24 | External/vendor | Are there any partner conversations underway yet for the v3 "Act" BaaS partner (auto-funding the tax sub-account)? |

**P3 — enhancement or future clarification**

| # | Stakeholder | Question |
|---|---|---|
| 25 | Finance | What billing/payment integration (e.g., Stripe) and data model will support the eventual $15–30/mo subscription, once C1 validates? |
| 26 | Product | Beyond the individual per-hypothesis thresholds, what single north-star metric will define post-capstone product success? |
| 27 | Product/doc owner | Should the "v3 Brief" reference in PRD-v2.md be corrected to "v2," or does an actual v3 document need to be created? |

---

## 14. Recommended next steps for Pass 2

*(Recommendations, not decisions — flagged per instructions as [Recommendation].)*

1. **[Recommendation]** Resolve the P0 questions in §13 first — several (tax-rule state list,
   correction-log implementation, data-model.md commit status) are pure documentation/decision
   fixes that cost little and unblock everything downstream.
2. **[Recommendation]** Before any backlog or epic work begins, get an explicit answer on
   whether P1–P3/A1 validation will run in parallel with the build (as hypotheses.md
   recommends) — this changes whether backlog items should be sequenced "build first, validate
   later" or "validate gates before automating."
3. **[Recommendation]** Once the correction-log and `is_commingled` ambiguities are resolved,
   Pass 2 can safely move into ERD refinement (splitting the deposit/outflow label enum,
   adding retention/consent fields) without redesigning the overall schema, which is otherwise
   sound.
4. **[Recommendation]** Treat the persona-coverage gap (no support/compliance/admin personas) as
   a Pass 2 input only if the program's rubric requires operational personas — for a Demo-Day-scoped
   capstone with no real users, this may be legitimately out of scope, but it should be a
   conscious scoping decision, not a silent omission.
5. **[Recommendation]** Carry the risk register (§11) forward into whatever planning artifact
   Pass 2 produces — in particular R-004/R-006/R-009 (validation risk, classifier accuracy,
   tax-math accuracy) are the three the docs themselves repeatedly call existential, and should
   anchor the next phase's priorities regardless of format.
