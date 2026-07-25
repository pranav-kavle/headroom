# Headroom — Product Requirements Document

**Version:** 2.0 (fully revised) · **Date:** 2026-07-11 · **Demo Day:** 2026-08-14
**Owner:** Pranav Kavle · **Status:** Draft for build
**Supersedes:** PRD v1.0 (2026-06-27)
**Companion docs:** v3 Brief · One-pager · Personas · Hypotheses · AI Agent design

---

## 1. TL;DR

Headroom is the first decision engine in an **autonomous financial
decision system for one-person and very small service businesses.** It begins
by continuously answering and defending one high-stakes question:

> **How much can I safely pay myself right now?**

It reads a freelancer's bank data, classifies which deposits are real income,
forecasts the period forward, and produces the **Safe-to-Pay Number** — the most
the user can pay themselves this period while keeping estimated taxes funded and
runway above a floor — then **re-plans in the background when reality changes**
and surfaces the single decision that matters.

This PRD scopes the **Demo Day build (Aug 14)**. The product design and the
program's seven acceptance bars are the same shape, so *the build is the rubric*.
Everything here is scoped to a demonstrable, deployed, traced system driven by
scripted data on stage.

**The demo we build toward:** the agent catches a tax/runway shortfall weeks
before it lands — "the save" — live, triggered by a changed input, with the
genuinely AI-hard step (classifying a commingled deposit) visible on stage.

**What changed from v1 (and why):**

| Change | Rationale |
|---|---|
| Reframed from "operating system" to **"decision system"** | Honest to a recommend-only v1; names the atomic unit (the recurring decision) and the real moat (accumulated decisions + outcomes), not a static per-user file. |
| **Income classification promoted to the core AI moment** — visible in the demo | v1 presented AI as a re-planning veneer over deterministic math. The genuinely AI-hard task (client income vs. transfer/refund/repayment on a commingled account) is now first-class and shown live. |
| Architecture recast as **one deterministic engine + one orchestrating agent** (not two peer skills) | The two "skills" both called the same waterfall; Re-planner was the Synthesizer re-run. The credible, safe, demonstrable shape is engine (arithmetic) + agent (judgment). |
| **Canonical scenario locked** — one number, one date, one set of floors | v1 carried three different Safe-to-Pay numbers and an incorrect tax date (Jul 15). A wrong number/date is an instant uninstall for a trust product. |
| Seasonal-ML spend forecast **trimmed** to detected recurring + trailing average with a range | The most build-heavy, most fragile, least-defensible piece for a live demo. Kept subordinate to the number; no learned model. |
| Moat reframed away from the per-user file toward **decisions + outcomes + eventual execution** | A corrections file sitting on Plaid data an incumbent also holds is largely re-derivable; treat defensibility as a hypothesis, not a claim. |

---

## 2. Product objective

Produce and defend a **trustworthy, forward-looking Safe-to-Pay Number** for a
sole-proprietor freelancer with irregular income, and re-decide it automatically
when reality changes — so the user buys *ongoing financial control and fewer
surprises*, not access to a chatbot. For the capstone: demonstrate the full loop
reliably on stage and satisfy all seven acceptance bars with proof artifacts.

## 3. User problem

Salaried people budget against a fixed paycheck. Freelancers can't. Income is
lumpy; every incoming dollar is contested by obligations that move weekly —
quarterly estimated taxes (the silent killer), runway, owner pay, debt, savings.
When an invoice slips or a surprise cost lands, the allocation is silently wrong,
and the freelancer either re-does the mental math (exhausting, weekly) or doesn't
(and gets a tax bill they can't cover). The real pain is **allocation collapse
under irregular income** and the recurring dread of *"can I afford to pay myself
this month?"* Existing tools are dashboards built for fixed income: they show the
past and make the user re-decide.

**A structural point that defines the product:** a sole-proprietor usually runs
personal and business money through **one commingled account**. Distinguishing
client income from transfers, refunds, reimbursements, loan proceeds, and peer
payments is where every downstream number lives or dies — and it is not
solvable by rules. This is why the product needs AI, and why it works for the
real freelancer with a messy account rather than only for the disciplined one
who least needs it.

## 4. Target user (ICP) — narrowed for v1

**The irregular-income solo earner filing as a sole proprietor (Schedule C):**
lumpy/unpredictable income, files (or should file) quarterly estimated taxes, no
bookkeeper, commingled personal/business account, handles money decisions alone.

**Explicitly out of scope for v1:** S-corp owners (reasonable-comp payroll +
distributions), multi-member entities, anyone needing actual filing. These have a
different tax shape; a Safe-to-Pay Number that silently assumes Schedule C would
be *wrong* for them and churn them angry. Signup must gate on filing structure.

*Long-term market (positioning only, not v1 scope):* one-person and very small
**service** businesses (labor-in, invoice-out, no inventory) — same
allocation-collapse shape, same engine.

## 5. The hero output — the Safe-to-Pay Number

One line the entire system defends:

> *"$3,650 — the most you can pay yourself this period and stay tax-safe through
> Q3, with runway holding above your floor even if Acme pays 30 days late."*

Properties: **forward-looking** (forecasts the breach, doesn't reconcile the
past), **tax-aware** (estimated taxes set aside first), **conservative**
(over-reserve beats a surprise bill — the promised number is the low end of the
range), **explained** (every figure is a range with its assumption stated). The
first session leads with **the catch** — a pre-mortem surfacing a shortfall from
backfilled data — because the save is the hook.

## 6. Scope

### In scope (the core loop — build for real)

Connect bank + backfill · **AI income classification with confidence + one-tap
confirm** · deterministic priority waterfall with hard floors · conservative
Schedule C tax estimate (federal + 1–2 states) · the Safe-to-Pay Number with
range and reasoning · background re-plan on triggers · the catch · earned
attention (one decision or silence) · trust wrapper (ranges, conservative bias,
NFA disclaimer).

### Non-goals (explicitly out for the demo)

- **No money movement** (no Auth/ACH; read + recommend only).
- **No live invoicing integration** (Stripe/QBO) — expected income is manual.
- **No S-corp support** — sole-prop / Schedule C only.
- **No real production bank data on stage** — demo runs on scripted data.
- **No multi-state tax matrix at scale** — federal + a small fixed state set.
- **No learned/ML spend prediction** — detected recurring + trailing/seasonal
  average with a range. Subordinate to the number, not a standalone budget view.
- **No SOC 2 / full security program** — demo-grade posture only (§16).
- **No broader decision-system features** (collections, hiring affordability,
  project pricing, execution) — positioning and roadmap only.

## 7. Canonical demo scenario (single source of truth)

Every number, date, and floor below is internally consistent and is the **only**
scenario the artifacts may use. Dates are scripted for the demo.

**Persona:** *Dev* — freelance developer · Schedule C · single · CA
**As of:** Sep 3, 2026 · **Period:** current month · **Bank balance:** $11,900
**Goal config:** runway floor **$6,000** (~2 mo essentials) · target pay
**$6,000** · savings goal **$2,000** · debt **$500** · priority **Taxes → Runway
floor → Pay → Savings → Debt**

**Tax (Q3 estimate):** due **Sep 15 (12 days out)** · target set-aside **$4,800**
· funded **$3,900** · **gap $900**

**Recurring expenses (detected):** rent $2,100 · software $240 · health insurance
$510 · **Vercel Pro $89 (newly detected)** = **$2,939** · variable (24-mo
trailing) $900–$1,211

**Income sources:** monthly retainer $2,800 (expected) · **Acme Corp #1042 $5,000
(pending)** · Carter rebrand $1,400 (possible)

**Two states of the world:**

| | Conservative income | Safe-to-Pay | Taxes | Runway | Savings/Debt |
|---|---|---|---|---|---|
| **On-time** (Acme pays) | ~$7,800 | **$6,000** (target met) | $900 gap flagged | held | funded in order |
| **Acme slips 30 days** *(the catch)* | ~$2,800 | **$3,650** (range $3,650–$5,050) | topped up, funded | held at $6,000 | savings paused, debt deferred |

**Derivation of $3,650 (the promised number is the conservative/low end):**
`Safe-to-Pay = clamp(balance + income_low − outflow_high − tax_gap − runway_floor, 0, target_pay)`
`= clamp(11,900 + 2,800 − 4,150 − 900 − 6,000, 0, 6,000) = $3,650.`
Waterfall then funds: taxes top-up $900 → runway $6,000 → pay $3,650 → savings
$0 (paused) → debt $0 (deferred). Fully consistent; defensible live.

---

## 8. Demo Day acceptance criteria (the contract)

Each bar maps to a component, a proof artifact, and a due week. **Program weeks:
W1 = wk of Jun 23 … W8 = wk of Aug 11 (Demo Day Aug 14).**

| # | Bar | Component that satisfies it | Proof on stage | Due |
|---|---|---|---|---|
| 1 | Configurable goal + one-page spec | Goal config (tax profile, runway floor, target pay, savings, debt, priority) in the custom engine; editable in UI. | Show spec; live-edit a goal, number recomputes. | W2 |
| 2 | Background agentic re-planning on changed inputs | Headless Agent SDK runner wired to 3 trigger types → orchestrating agent invokes the engine + skills. | Fire all 3 triggers live; show re-plan + updated number. | W4–W5 |
| 3 | ≥3 source types via MCP, ≥1 custom MCP authored | **4** MCP sources: aggregator, tax-rule, expected-income, **custom Financial State + Priority Engine**. | Show MCP server list; identify the authored one. | W2–W3 |
| 4 | ≥2 multimodal outputs beyond text | **Interactive dashboard** + **PDF plan** + **email "the catch"**. | Show dashboard, download PDF, show alert email. | W4–W6 |
| 5 | ≥2 named Skills, prompt + ≥3 evals each; ≥1 skill invoked from Claude Code (dev) AND headless runner (prod) | Core: **Transaction Interpreter** (5) + **Cashflow Synthesizer** (5) + **Re-planner** (4). If time: **Materiality Evaluator** (3) + **Alert Composer** (3). Synthesizer is dual-invoked. | Run eval suites; invoke Synthesizer in Claude Code and in the deployed runner. | W3–W5 |
| 6 | Live deploy, HTTPS, Clerk, costs capped | Frontend + runner deployed; Clerk auth; cost cap. (Program infra.) | Open live URL, Clerk login, show cost cap. | W5 + W8 |
| 7 | Langfuse traces of the agentic loop + spend ceiling | Loop instrumented with Langfuse; ceiling enforced. (Program infra.) | Open Langfuse, show a full re-plan trace + ceiling. | W7 |

**Margin note:** Bar 3 ships **4** sources (min 3), Bar 4 ships **3** outputs
(min 2), and Bar 5 ships **3 core skills** (min 2), with 2 more if time allows —
so a single slip does not fail a bar.

---

## 9. System architecture

```
   TRIGGERS [Bar 2]           ┌───────────────────────────────────────────┐
   ├─ cron schedule ─────────▶│  ORCHESTRATING AGENT (Agent SDK, PROD)     │◀─ Claude Code (DEV)
   ├─ txn webhook (source) ──▶│  judgment layer:                           │   invokes same Skill
   ├─ manual feedback ───────▶│   • interpret trigger / user message       │   [Bar 5 dual-invoke]
   └─ ambiguous deposit ─────▶│   • Transaction Interpreter on unclear txns│
                              │   • Materiality → surface or stay quiet    │
                              │   • Alert Composer writes one message      │
                              └───────────────┬───────────────────────────┘
                                              │ MCP tool calls (deterministic)
        ┌──────────────────┬─────────────────┼─────────────────┬─────────────────────┐
        ▼                  ▼                 ▼                 ▼                     ▼
  ┌───────────┐    ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────────┐
  │Aggregator │    │ Tax-rule    │  │ Expected-    │  │ Financial State + Priority     │
  │MCP        │    │ MCP         │  │ income MCP   │  │ Engine MCP   ★CUSTOM (authored)★│
  │Plaid/     │    │ rates,      │  │ manual       │  │ goal config · allocation ·     │
  │Teller     │    │ brackets,   │  │ invoices     │  │ safety floors · projections ·  │
  │txns/bal   │    │ due dates   │  │              │  │ correction log                 │
  └───────────┘    └─────────────┘  └──────────────┘  └────────────────────────────────┘
     source 1        source 2          source 3          source 4 + custom server

   SKILLS [Bar 5]: Transaction Interpreter · Cashflow Synthesizer · Re-planner · (Materiality Evaluator · Alert Composer)
   OUTPUTS [Bar 4]: Interactive dashboard · PDF plan · Email "the catch"
   CROSS-CUTTING: Langfuse [Bar 7] · Clerk + cost cap [Bar 6/7] · deployed URL [Bar 6]
```

**The load-bearing idea:** the agent owns the messy boundary between the real
world and a deterministic engine. The engine is a calculator that is always right
*given clean inputs*; the real world never gives clean inputs. The agent's job is
to turn ambiguous, unstructured signal (a commingled deposit, "Acme paid late")
into the clean, confidence-scored inputs the engine needs — and to turn the
engine's output back into one human decision.

**Stack assumptions (confirm against program infra):** Next.js frontend; Agent
SDK (TypeScript) headless runner; MCP servers in TS/Python; Postgres for the
Financial State store; Clerk auth; Langfuse tracing.

**Aggregator decision:** build behind an **aggregator-agnostic MCP interface**
(`get_transactions`, `get_balances`, `get_accounts`) so Plaid or Teller can sit
behind it. **Demo runs on scripted/sandbox data;** a real-data proof is a
parallel, non-blocking track.

---

## 10. AI vs. deterministic boundary (non-negotiable)

The model must **never invent or override a financial fact.** It proposes; the
engine computes; low confidence escalates to the user.

| Responsibility | Owner | Why |
|---|---|---|
| Financial arithmetic, priority allocation, floor enforcement | **Deterministic engine** | Must be exactly reproducible; a wrong number destroys trust. |
| Tax-rule lookup, bracket/QBI/SE math, due-date calculation | **Deterministic engine** | Reference data + formulas, not judgment. |
| Balance reconciliation, scenario computation, range math | **Deterministic engine** | Same. |
| **Classifying ambiguous transactions** (deposits *and* expenses) with a **confidence score + evidence** | **AI (Transaction Interpreter)** | Judgment over messy merchant strings/memos/patterns; rules fail on the long tail. |
| Turning unstructured signal into structured state ("Acme paid late" → invoice status=late, +30d) | **AI (orchestrating agent)** | Intent parsing; deterministic code can't. |
| Deciding **whether** a change is material, and **which** decision to surface | **Hybrid (Materiality Evaluator)** | Deterministic thresholds (floor breach, tax proximity, Safe-to-Pay delta) first; AI only as a tiebreaker for ranking — earned attention, auditable. |
| Interpreting patterns (windfall vs. new recurring vs. cadence break) | **AI**, then confirmed by engine rules | Interpretation is judgment; treatment is deterministic. |
| Explaining the tradeoff / writing the personalized alert | **AI (orchestrating agent)** | Narration of a deterministic result — lowest-stakes AI. |

**Falsifiability check we hold ourselves to:** strip the LLM out — if the product
still works on the demo data, the AI was ornamental. It is only load-bearing if
the product collapses on *real commingled data* without the Transaction Interpreter. Build the
demo so that is visibly true.

---

## 11. Functional requirements

### 11.1 Onboarding & goal configuration (Bar 1)
- **FR-1** Connect a bank source (sandbox/scripted for demo) via the aggregator MCP.
- **FR-2** **Seed pass:** propose detected income, cadence, and top categories from backfill; user confirms/corrects (cold-start of the correction log).
- **FR-3** Configure the goal: tax profile, runway floor, target pay, savings, debt, priority hierarchy. Defaults proposed from data, editable.
- **FR-4** Persist all of the above in the Financial State engine.

### 11.2 Transaction Interpreter (Bar 5, Skill 1 — the AI moment)
- **FR-5** Classify each **deposit** as `income | transfer | refund | repayment | loan | other`, and each **outflow** as `fixed/recurring | variable/discretionary`, with a **confidence score + extracted evidence** (the memo tokens / counterparty / frequency that justify the label).
- **FR-6** Items below a confidence threshold are **surfaced for one-tap confirmation** (with their evidence), never silently assumed; the confirmation is written to the correction log.
- **FR-7** Detect cadence (project / retainer / windfall); **never treat a lumpy windfall as recurring.**
- **FR-8** A confirmed classification **visibly moves the Safe-to-Pay Number** (the demo's proof that AI is load-bearing).

### 11.3 Cashflow Synthesizer (Bar 5, Skill 2 — deterministic core, dual-invoked)
- **FR-9** Project period income with a range (from classified income + expected-income entries).
- **FR-10** **Forecast expenses** with a range — detected recurring + variable (trailing/seasonal average, **no learned model**) — as the outflow side.
- **FR-11** Compute a conservative tax set-aside (SE + federal brackets + QBI + half-SE deduction).
- **FR-12** Allocate against the priority order, respecting safety floors.
- **FR-13** Reconcile to actual balances; derive the Safe-to-Pay Number + runway forecast.
- **FR-14** Output (structured): number + range + reasoning · per-bucket allocation w/ funded status · income projection ± range · runway projection · tax-bomb status · feasibility report.

### 11.4 Re-planner (Bar 2 + Bar 5, Skill 3)
- **FR-15** Re-decide the remaining period when an input changes; protect floors, re-allocate optional buckets.
- **FR-16** Output: revised allocation + updated number · updated projections · **the one decision the user must make** · one-line "what changed + why."
- **FR-17** Capture the user's response as a correction (feeds the correction log).

### 11.5 Background agent & triggers (Bar 2)
- **FR-18** **Schedule trigger:** scheduled job regenerates the plan/number and ramps the tax set-aside as the due date nears.
- **FR-19** **Source-event trigger:** transaction webhook fires the loop (and the Transaction Interpreter on any unclear transaction).
- **FR-20** **Manual-feedback trigger:** user action (e.g. "Acme paid late") fires the loop.
- **FR-21** Earned attention via the **Materiality Evaluator** (hybrid, deterministic-first): a change is surfaced only if it clears explicit thresholds (floor breach, tax proximity, Safe-to-Pay delta) or introduces a new recurring commitment; otherwise stay silent. AI ranks only when several material changes compete.

### 11.6 Outputs (Bar 4)
- **FR-22** **Interactive dashboard** with the Safe-to-Pay Number front and center, allocation, runway, tax-bomb status.
- **FR-23** **PDF** cashflow & tax plan, on demand.
- **FR-24** **Email** delivering "the catch" with the one decision, written by the **Alert Composer** (numbers must match the engine's output — a mismatch check rejects any copy that drifts).

### 11.7 Safety floors (cross-cutting)
- **FR-25** Tax set-aside floor is never under-funded to free up pay/savings; the shortfall is flagged instead.
- **FR-26** Runway floor breach is never recommended without an explicit surfaced warning.

### 11.8 Connect & spending forecast (trimmed)
- **FR-27** Connect bank account(s) and backfill up to 24 months of transactions.
- **FR-28** Categorize transactions (fixed/recurring vs. variable/discretionary).
- **FR-29** Detect recurring expenses; flag new or changed recurrences (also a re-plan trigger).
- **FR-30** Predict next-period spending with a range via **trailing + seasonal average (no learned model)**, feeding the runway forecast and the number. Subordinate to the number; **not** a standalone budget view.

---

## 12. Data requirements

**Sources (Bar 3):**

| Source | Type | Custom? | Key tools |
|---|---|---|---|
| Aggregator | Bank txns/balances + up to 24-mo backfill (Plaid/Teller behind agnostic interface) | wrapper | `get_transactions`, `get_balances`, `get_accounts` |
| Tax-rule | Seeded rate/bracket/due-date reference (federal + small state set, versioned per tax year) | seeded | `get_tax_rules(filing_status, state, year)`, `get_due_dates(year)` |
| Expected-income | Manual invoice/expected-income entries | in-app | `list_expected_income`, `mark_invoice_late` |
| **Financial State + Priority Engine** | Core memory + allocation engine + correction log | **★ authored ★** | `get_state`, `set_goal`, `compute_allocation`, `classify_transaction`, `record_correction`, `get_projections` |

**Key entities (Financial State engine):** GoalConfig · IncomeEvent (amount, date,
source, **classification, confidence, cadence tag**) · ExpectedIncome (amount,
date, status pending/late/received) · Allocation (per-bucket amount + funded
status) · Projection (income range, runway ± range, tax-bomb status, assumptions)
· **Correction** (user label/override — the correction log) · RecurringExpense
(merchant, amount, cadence, status active/new/changed) · SpendForecast (predicted
next-period spend, range + assumption) · Category (txn → fixed/variable) · CheckIn
(surfaced decisions + responses).

---

## 13. User flows

**A. First session (the catch).** Connect → 24-mo backfill → seed pass proposes
income/cadence/categories → user confirms a couple of **low-confidence deposits**
(AI moment) → engine computes → *the catch* opens: "you're tracking $900 short on
Q3 taxes — here's the one move." User reviews the full plan.

**B. Re-plan (reality changes).** A trigger fires (below) → agent interprets it,
classifies any unclear new deposit, calls the engine → number updates → **one
decision** surfaced + one-line "what changed & why" → email if consequential.

**C. Quiet day.** Scheduled run finds nothing consequential → no interruption
(earned attention). Dashboard still reflects the latest plan if opened.

## 14. Trigger model

| Trigger | Example | Fires |
|---|---|---|
| Schedule (cron) | Nightly run; tax-set-aside ramp as due date nears | Synthesizer, silent unless changed |
| Source event (webhook) | A Stripe payout of $1,450 lands; an unclear deposit appears | Classifier (if unclear) → Re-planner |
| Manual feedback | User: "Acme paid late" | Intent parse → Re-planner |
| Threshold | Balance below floor; new recurring detected; tax due proximity | Re-planner |

Every trigger that surfaces a decision captures the user's response as a
correction.

## 15. Safety, error & uncertainty handling

- **Floors override optimization.** Taxes and runway are funded before optional
  buckets, always; a shortfall is *flagged*, never hidden.
- **Bias to ask on high-magnitude, low-confidence deposits.** Mis-labeling a large
  transfer as income inflates Safe-to-Pay and can push a user into a tax hole — a
  single such event ends trust permanently, so the system asks rather than guesses.
- **Every figure is a range with its assumption stated;** the promised number is
  the conservative (low) end.
- **Stale/broken feed detection:** flag rather than silently going wrong.
- **NFA posture:** "I organize your own data and show tradeoffs. I do not provide
  tax, investment, or financial advice. Tax figures are conservative estimates —
  confirm with your accountant." Counsel review of the disclaimer scheduled before
  the tax engine is trusted for real users.
- **Classifier low-confidence path:** surface for confirmation; do not compute a
  number that depends on an unconfirmed high-magnitude deposit.

## 16. Non-functional requirements & observability

- **Security (demo-grade):** access tokens encrypted at rest, never exposed to
  frontend; Clerk-gated; no real PII on stage (scripted data).
- **Cost:** spend ceiling enforced (Bar 7); model calls capped per run.
- **Observability:** Langfuse traces on every agentic loop, including each
  interpreter call with its confidence (Bar 7).
- **Reliability:** demo runs deterministically off scripted data; no dependence on
  a live bank OAuth flow on stage.

## 17. Evaluation criteria & acceptance criteria

**Skill evals (build gate — all green before Demo Day):**

- **Transaction Interpreter (5):** (1) clean retainer deposit → income, high conf.
  (2) round-number transfer from user's own savings → transfer, not income.
  (3) client Zelle with a person's name in memo → income, **low conf → asks**,
  evidence cites the memo. (4) refund from a software vendor → refund, excluded.
  (5) $20k one-off project deposit → income but **windfall cadence**, not recurring.
  *(Expense-side recurring detection is covered in Synthesizer eval 5.)*
- **Cashflow Synthesizer (5):** (1) normal ~$8k month funds taxes + baseline pay +
  savings in order; runway holds. (2) infeasible ~$3k month funds tax + runway
  floor, reports "pay short, savings paused," never under-funds taxes. (3) lumpy
  $20k windfall smoothed over cadence. (4) tax-floor boundary: set-aside never
  skipped for optional buckets. (5) spend forecast from 24-mo history within range;
  runway reflects forecasted outflows.
- **Re-planner (4):** (1) expected $5k slips → pause savings + defer discretionary,
  protect tax + runway, lower the number, surface the one decision. (2) surprise
  large expense → re-allocate; report what was sacrificed by priority. (3)
  quarterly tax due in 10 days + set-aside short → ramp set-aside, don't raid
  runway silently. (4) new recurring subscription → recalc runway, flag drift.
- **Materiality Evaluator (3, if built):** (1) $12 subscription drift on a healthy
  plan → **not material, silent**. (2) Acme slips → floor at risk → **material,
  surface**. (3) tax gap + minor expense same day → surfaces the tax gap (higher rank).
- **Alert Composer (3, if built):** (1) copy numbers exactly match the engine.
  (2) the one decision appears in the first two lines. (3) all-clear run → no alert.

**Acceptance (the contract):** all seven bars in §8 demonstrated live with proof
artifacts; **14/14 core evals green** (+6 if Materiality/Alert are built); the
canonical scenario reproduces $3,650 on stage; the interpreter-confirm visibly
moves the number.

## 18. Demo script (golden path)

1. **Open on the catch** — Dev (scripted) sees: *"You're tracking $900 short on Q3
   taxes — here's the one move."* (Bar 4 email + UI.)
2. **The AI moment** — the Transaction Interpreter surfaces a low-confidence
   deposit with its evidence ("$4,200 · Zelle from J. Rivera · memo 'inv' · client
   payment or personal?"); confirm it → **the Safe-to-Pay Number visibly
   recomputes.** (Bar 5, Transaction Interpreter.)
3. **Show the number** with its range, reasoning, and the predicted spending that
   drives runway. (Bar 1 / Synthesizer.)
4. **Live re-plan, 3 ways** — push a scripted transaction (webhook), click "Acme
   paid late" (manual), reference the scheduled run (cron). Number drops to
   **$3,650**, savings pause, the one decision surfaces. (Bar 2.)
5. **Download the PDF plan.** (Bar 4.)
6. **Behind the curtain** — MCP server list (Bar 3), Synthesizer running in Claude
   Code and in the deployed runner (Bar 5), a Langfuse trace of the re-plan loop
   with the spend ceiling (Bar 6/7).

**Demo data:** three scripted personas — *normal month* (Maya), *the catch* (Dev,
default), *windfall* (Sam) — 24 months each, driven by scripted/sandbox
transactions for deterministic, reproducible runs. Across A/B/C they exercise all
14 evals, all 3 triggers, and all 3 outputs.

## 19. Build labels (what's real vs. scripted vs. gated)

| Label | Meaning | Items |
|---|---|---|
| **Build real** | Actually implemented for the demo | Custom Financial State + Priority Engine; Transaction Interpreter; Synthesizer; Re-planner; orchestrating agent + 3 triggers; 3 outputs; goal config |
| **Build if time** | High value, low cost; cut before the core | Materiality Evaluator; Alert Composer |
| **Simulate** | Scripted/deterministic, no weakening of the argument | Bank data on stage; the "background" schedule firing; the seeded tax-rule table (real reference data, static) |
| **Validate before automating** | Trust-critical; a wrong answer destroys trust | Tax math vs. real filed Schedule C returns; classifier precision/recall on real anonymized commingled statements — both gate whether the catch is safe to automate for real users |
| **Defer** | Post-capstone | Money movement/execution; S-corp; live invoicing; learned-ML spend; audio briefing; receipt vision; broader decision-system features |

## 20. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wrong number/date on stage | Canonical scenario locked (§7); scripted personas validated pre-demo; ranges + disclaimer; $3,650 derived from the waterfall. |
| AI reads as ornamental | Transaction classification is first-class and the interpreter-confirm **visibly moves the number** live; falsifiability check in §10. |
| "Just a budgeting dashboard" | Forward-looking; Safe-to-Pay hero; decision-system framing; spend forecast trimmed and subordinated. |
| A wrong classification inflates the number | Bias to ask on high-magnitude/low-confidence deposits; confirmation required before the number depends on them. |
| Bar 3/4/5 thins if something slips | Ship 4 sources, 3 outputs, 3 skills (built-in margin). |
| Live bank OAuth breaks on stage | Demo off scripted data; real-data proof is a parallel non-blocking track. |
| Program infra (Clerk/Langfuse/deploy) slips | Front-load W5/W7; hard gates in dry-run #1. |
| Moat overclaim | Framed as hypothesis (decisions + outcomes + eventual execution), not the per-user file. |

## 21. Milestones (to Aug 14, by program week)

| Week | Dates | Milestone |
|---|---|---|
| **W1** | Jun 23–29 | PRD + Demo DoD locked; custom **Financial State + Priority Engine** skeleton; goal config schema; **canonical scenario fixtures**. |
| **W2** | Jun 30–Jul 6 | Goal config end-to-end (Bar 1); aggregator MCP w/ scripted data; tax-rule MCP seeded. |
| **W3** | Jul 7–13 | **Transaction Interpreter** + **Cashflow Synthesizer** skills + evals green (Bar 5); expected-income MCP (Bar 3 complete). |
| **W4** | Jul 14–20 | **Re-planner** + evals; headless runner with 2 of 3 triggers (Bar 2); dashboard v1 + **interpreter-confirm UI** (Bar 4/5). |
| **W5** | Jul 21–27 | All 3 triggers live (Bar 2); deploy + Clerk (Bar 6); PDF output (Bar 4). |
| **W6** | Jul 28–Aug 3 | Email "the catch" (Bar 4); dual-invocation proven (Bar 5); demo personas scripted. |
| **W7** | Aug 4–10 | Langfuse + spend ceiling (Bar 7); end-to-end dry-run #1. |
| **W8** | Aug 11–14 | Final deploy (Bar 6); dry-runs #2–3; **Demo Day Aug 14**. |

**Critical path:** custom engine → sources → interpreter + Synthesizer + evals →
runner + triggers → outputs → infra wrap. **If schedule slips, cut in this order:**
Alert Composer → Materiality Evaluator → scheduled-trigger polish → PDF styling →
windfall persona (C) → seasonal spend detail. **Never cut:** the
interpreter-confirm moment, the $3,650 re-plan, and the tax-math validation.

## 22. Post-capstone roadmap (positioning — not v1 scope)

- **v1 · Decide** *(this build):* Safe-to-Pay decision engine, recommend-only,
  sole-prop Schedule C.
- **v2 · Deepen:** adjacent decisions reusing data already held — tax reserves,
  runway protection, cash-flow planning, expense decisions. No new data dependency.
- **v3 · Act:** the recommend→execute crossing — auto-fund the tax sub-account via
  a BaaS partner, with approval. The real moat test.
- **v4 · Expand:** new-data decisions (invoice collections, hiring affordability,
  project pricing) and the market widening to very small service businesses.

## 23. Open questions

- Exact v1 state set for the tax-rule seed (federal + which 1–3 states).
- Classifier confidence threshold for the confirm prompt; precision/recall target
  on real commingled data.
- Aggregator for the real-data proof track: Teller (faster) vs. Plaid limited prod.
- Email delivery mechanism (program-provided vs. third-party).
- Confirm program stack specifics (DB, runner host, Agent SDK language).
