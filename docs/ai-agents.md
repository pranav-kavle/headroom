# Headroom — AI Agent Design

*v2 · 2026-07-11 · Companion to PRD v2 (see §9–§10 for the architecture diagram
and the AI/deterministic boundary table)*

## Recommended architecture: one agent, one engine, three skills

**One orchestrating agent + one deterministic engine.** Not a swarm of agents.

The temptation with "identify the AI agents" is to invent several — a
"Forecasting Agent," a "Tax Agent," a "Runway Agent." Resist it. Financial math
must be **exactly reproducible**, and multiple agents reasoning independently over
money multiplies the surface for a hallucinated or inconsistent number — the one
failure this product cannot survive. More agents would be *multi-agent theater*:
harder to trace, harder to demo, and less safe.

The credible, safe, demonstrable shape:

- **The Orchestrating Agent** is the *only* true agent — the judgment layer that
  owns the messy boundary between the real world and the engine. It interprets
  triggers and user messages, decides which tools/skills to call, picks the single
  decision to surface (or stays silent), and narrates.
- **The Priority Engine** is a **deterministic service** (the custom MCP), not an
  agent. It does all arithmetic, allocation, floor enforcement, tax math, and
  scenario computation. The model never does this.
- **Skills the agent wields**, of distinct kinds — none of which compute or
  override the number:
  1. **Transaction Interpreter** — a genuine **AI skill**: classifies ambiguous
     deposits *and* expenses and extracts the evidence for each call.
  2. **Cashflow Synthesizer** — a **deterministic engine call + a thin AI
     explanation** (the engine computes; the model narrates).
  3. **Materiality Evaluator** — a **hybrid, deterministic-first** gate: decides
     whether a change deserves the user's attention (the basis of earned silence).
  4. **Alert Composer** — a low-stakes **AI narration** skill: engine output → one
     concise user message.
  5. **Re-planner** — an **orchestration pattern**, not new logic: the agent
     re-invoking the Synthesizer on changed state and selecting the one decision.
  6. **Expected-Income Interpreter** — **AI parsing**, scoped: free-text/manual
     "Acme paid late" for v1; email ingestion is a fast-follow.
  7. **Document Intake** — **deferred (post-capstone)**: vision/OCR extraction from
     statements/invoices; designed-for, not built for v1.

**The safety rule that lets all of these coexist:** they are *skills of one
orchestrator*, not independent agents. Classification, parsing, narration,
extraction, and attention-gating are perception and communication layers — **only
the deterministic engine produces or changes a financial figure.** Adding skills
is safe; adding decision-makers that touch the number is not.

This maps to a single, legible Langfuse trace (Bar 7) and over-satisfies Bar 5
(≥2 named skills; Synthesizer is the dual-invoked one). It also makes the AI/​
deterministic split obvious to an evaluator — which is the point.

**Should the v1 "Cashflow Synthesizer + Re-planner" structure remain?** Partly.
Keep the *names* (they're on the acceptance bars), but re-cast them honestly:
Synthesizer is a deterministic service with an explanation layer, and Re-planner
is the agent re-running it — not a second reasoning engine. The first-class AI
skill that was missing is now the **Transaction Interpreter**.

### Build scope (so the roster doesn't balloon the schedule)

| Skill | Build for capstone | Eval suite |
|---|---|---|
| Transaction Interpreter | **Must-build** (the AI moment) | 5 (full) |
| Cashflow Synthesizer | **Must-build** (dual-invoked) | 5 (full) |
| Re-planner | **Must-build** | 4 (full) |
| Materiality Evaluator | Build if time (cheap, high trust value) | 3 (light) |
| Alert Composer | Build if time (cheap) | 3 (light) |
| Expected-Income Interpreter | Manual path only; rides orchestrator evals | — |
| Document Intake | **Defer** | — |

Bar 5 is satisfied with margin by the top three alone (min is 2). Materiality and
Alert are high-value, low-cost adds; cut them before touching the core three.

---

## Component 1 — Orchestrating Agent *(the only true agent)*

- **Name:** Orchestrator (a.k.a. the Companion runtime).
- **Objective:** Keep the user's finances inside their safety constraints by
  turning real-world change into at most one clear decision — and staying silent
  when nothing matters.
- **Trigger:** Any of the four (PRD §14): cron schedule, source-event webhook,
  manual feedback, or a threshold breach.
- **Inputs:** The trigger event; current Financial State (goal config, allocation,
  projections, correction log); new transactions/balances; expected-income status;
  the user's natural-language message, if any.
- **Tools (MCP):** `aggregator.*`, `tax-rule.*`, `expected-income.*`, and the
  custom `engine.*` (`get_state`, `compute_allocation`, `get_projections`,
  `record_correction`). Skills: Transaction Interpreter, Cashflow Synthesizer,
  Materiality Evaluator, Alert Composer, Expected-Income Interpreter.
- **Deterministic functions it invokes (never performs itself):** all allocation,
  tax, floor, date, and scenario math via `engine.*` and `tax-rule.*`.
- **Reasoning responsibilities (the actual AI work):**
  1. **Interpret the trigger / parse the user message** into a structured state
     change ("Acme paid late" → `mark_invoice_late(#1042, +30d)`).
  2. **Decide which tools/skills to call, in what order** (plan the loop).
  3. **Route unclear transactions to the Transaction Interpreter;** respect its confidence.
  4. **Select the single most consequential decision** to surface — or decide
     nothing is consequential and stay silent (earned attention).
  5. **Narrate** the one-line "what changed & why" and the alert copy.
- **Outputs:** A structured state update; at most one surfaced decision with its
  reasoning; the alert (email/UI); a full trace.
- **Memory / state:** Reads/writes Financial State via the engine; does **not**
  hold financial truth in-context — the engine is the system of record. The
  correction log is the durable per-user memory.
- **Human approval boundaries:** Read + recommend only. It **proposes**; it never
  moves money, files, or commits an irreversible action. Any pay/reserve figure is
  a recommendation the user enacts manually.
- **Failure modes:** Mis-parsing a user message; calling the wrong tool; surfacing
  a trivial decision (noise) or suppressing a real one (missed catch);
  over-narrating a number the engine didn't produce.
- **Guardrails:** Cannot emit a Safe-to-Pay figure except one returned by
  `engine.compute_allocation`. Spend ceiling per run (Bar 7). Every surfaced
  number carries its range + assumption + NFA line. Silence is the default; a
  decision must clear a consequence threshold to interrupt.
- **Evaluation cases:** (a) "Acme paid late" → correct state mutation + re-plan.
  (b) A quiet nightly run with no material change → **no alert emitted.** (c) Two
  simultaneous issues → surfaces the higher-consequence one only. (d) A vague
  message ("things are tight") → asks a clarifying question rather than guessing.
- **When confidence is low:** Ask the user a single scoped question rather than
  act; never fabricate a state change from an ambiguous message.

---

## Component 2 — Skill: Transaction Interpreter *(the essential AI skill)*

*Generalizes the earlier "Income Classifier" to cover expenses too, and adds
evidence extraction.*

- **Name:** Transaction Interpreter.
- **Objective:** Classify ambiguous transactions — deposits *and* outflows — and
  **extract the evidence** for each call, so the inputs the number depends on are
  right and the user can see *why*.
- **Trigger:** New/unclassified transactions during backfill (seed pass) or on a
  source event; invoked by the Orchestrator.
- **Inputs:** Transaction fields (amount, date, counterparty/memo strings,
  channel, frequency), account context, the user's history and correction log.
- **Tools:** Read-only transaction context via `aggregator.*`; the correction log
  via `engine.get_state`.
- **Deterministic functions it invokes:** none for the classification itself; it
  **writes** confirmed labels to the engine via `record_correction`.
- **Reasoning responsibilities:**
  - *Deposits* → `income | transfer | refund | repayment | loan | other`, with
    cadence (`retainer | project | windfall`).
  - *Outflows* → `fixed/recurring | variable/discretionary`, detecting new/changed
    recurrences.
  - For each, emit a **confidence score + extracted evidence** (the specific memo
    tokens, counterparty match, or frequency pattern that justifies the label) —
    judgment over messy strings/patterns rules can't cover. The evidence is what
    the user sees at the confirm prompt.
- **Outputs:** Per-transaction `{label, cadence?, confidence, evidence}`.
- **Memory / state:** The correction log is its long-term memory — past user
  labels bias future classifications for that user.
- **Human approval boundaries:** High-magnitude, low-confidence transactions are
  **surfaced for one-tap confirmation**, never silently assumed.
- **Failure modes:** The fatal one — labeling a large transfer/loan as income,
  which inflates Safe-to-Pay and can push the user into a tax hole. Also:
  mislabeling a windfall as recurring; missing a new recurring expense.
- **Guardrails:** **Bias to ask** on high-magnitude, low-confidence items. The
  engine will **not** compute a number that depends on an unconfirmed
  high-magnitude deposit. Windfalls are never treated as recurring.
- **Evaluation cases (5):** (1) clean retainer → income, high conf. (2)
  round-number transfer from user's own savings → transfer, not income. (3) client
  Zelle with a person's name → income, **low conf → ask**, evidence cites the memo.
  (4) vendor refund → refund, excluded. (5) $20k one-off → income but **windfall**,
  not recurring. *(Expense-side coverage folds into the recurring-detection eval in
  the Synthesizer suite.)*
- **When confidence is low:** Surface for confirmation with its evidence; do not
  let the item enter the projection until confirmed; log the answer as a correction.

---

## Component 3 — Skill: Cashflow Synthesizer *(deterministic engine + AI explanation)*

- **Name:** Cashflow Synthesizer.
- **Objective:** Turn current state into the Safe-to-Pay Number + a funded
  allocation, and explain it in plain language.
- **Trigger:** After onboarding/seed; on any re-plan; dual-invoked from Claude Code
  (dev) and the headless runner (prod) — the Bar 5 dual-invocation.
- **Inputs:** Classified income + expected income; detected recurring + variable
  spend; goal config; balances; tax rules.
- **Tools:** `engine.compute_allocation`, `engine.get_projections`,
  `tax-rule.get_tax_rules`, `tax-rule.get_due_dates`, `aggregator.get_balances`.
- **Deterministic functions it invokes (the substance):** income projection with
  range; conservative tax set-aside (SE + brackets + QBI + half-SE); priority
  waterfall with floor enforcement; balance reconciliation; runway forecast. **All
  numbers come from here, not the model.**
- **Reasoning responsibilities (the thin AI part):** *only* the natural-language
  explanation of a computed result — the "here's why the number is $3,650" prose.
  It does **not** compute or adjust any figure.
- **Outputs:** Safe-to-Pay Number (range + reasoning) · per-bucket allocation w/
  funded status · income/runway projections · tax-bomb status · feasibility report.
- **Memory / state:** Stateless beyond its inputs; reads state, returns a plan.
- **Human approval boundaries:** Recommendation only.
- **Failure modes:** The explanation drifting from the computed numbers
  (narration ≠ math); presenting a point estimate without its range.
- **Guardrails:** The prose is generated **from** the engine's structured output
  and must cite the same figures; a mismatch check rejects any explanation whose
  numbers differ from the engine's. Conservative (low-end) number is the promised
  one.
- **Evaluation cases (PRD):** normal ~$8k month; infeasible ~$3k month (reports
  shortfall, never under-funds taxes); $20k windfall smoothed; tax-floor boundary;
  spend forecast reflected in runway. **Canonical scenario must reproduce $3,650.**
- **When confidence is low:** Not applicable to the math (deterministic). If inputs
  are unconfirmed (a pending classification), it reports the number as provisional
  and flags the dependency rather than guessing.

---

## Component 4 — Re-planner *(orchestration pattern, not a separate engine)*

- **Name:** Re-planner.
- **What it actually is:** the Orchestrator re-invoking the Synthesizer on changed
  state, then selecting the single decision the change produced. It is **not** a
  second reasoning engine — v1's framing of it as a peer skill overstated it.
- **Objective:** Re-decide the remaining period when reality changes; protect
  floors; surface the one decision.
- **Trigger:** Any re-plan trigger (PRD §14).
- **Inputs:** Prior plan + the new event (late invoice, new recurring, balance
  change, tax proximity, goal change).
- **Tools / deterministic functions:** same as the Synthesizer (it *is* the
  Synthesizer re-run), plus the Orchestrator's decision-selection.
- **Reasoning responsibilities:** none new beyond the Orchestrator's — recompute
  (deterministic) + select/narrate the one decision (agent).
- **Outputs:** Revised allocation + updated number · updated projections · the one
  decision · one-line "what changed & why."
- **Human approval boundaries / guardrails / memory:** inherit from the
  Orchestrator and Synthesizer.
- **Evaluation cases (PRD):** expected $5k slips → pause savings + defer
  discretionary, protect tax + runway, lower number, surface the decision; surprise
  expense; tax due in 10 days + short; new subscription.
- **Why keep the name:** it's on Bar 5 and it's a useful user-facing concept
  ("it re-planned"). Just don't architect it as independent logic.

---

## Component 5 — Skill: Materiality Evaluator *(hybrid, deterministic-first)*

- **Name:** Materiality Evaluator.
- **Objective:** Decide whether a change deserves the user's attention — the
  mechanism behind earned silence. Interrupt only when it's worth it.
- **Trigger:** After any recompute, before anything is surfaced.
- **Inputs:** The prior plan vs. the new plan; which floors/thresholds moved; tax
  proximity; magnitude of the Safe-to-Pay delta; user's recent alert fatigue.
- **Tools / deterministic functions:** `engine.get_projections` and simple rules —
  **this is deterministic first.**
- **Reasoning responsibilities:** Mostly **rules**: a change is material if it (a)
  moves Safe-to-Pay beyond a set threshold, (b) breaches or risks a floor, (c)
  crosses a tax-proximity window, or (d) detects a new recurring commitment. The
  **AI part is only a tiebreaker**: when several material changes compete, rank
  which single one to surface.
- **Outputs:** `{material: bool, reason, ranked_candidates[]}`.
- **Memory / state:** Tracks recent surfaced-alert cadence to avoid fatigue.
- **Human approval boundaries:** n/a (gates attention, not money).
- **Failure modes:** False negative (suppresses a real catch — the dangerous one);
  false positive (noise, erodes earned attention).
- **Guardrails:** Floor breaches and tax-shortfalls are **always material** (hard
  rule, never gated by the AI tiebreaker). Thresholds are explicit and auditable —
  silence is defensible, not a black box.
- **Evaluation cases (3):** (1) $12 subscription drift on a healthy plan → **not
  material, stay silent.** (2) Acme slips → floor at risk → **material, surface.**
  (3) tax gap + a minor expense same day → surfaces the tax gap (higher rank).
- **When confidence is low:** Default to the deterministic rules; if the AI
  tiebreaker is unsure which of two material items to lead with, surface the one
  touching a safety floor.

## Component 6 — Skill: Alert Composer *(low-stakes AI narration)*

- **Name:** Alert Composer.
- **Objective:** Turn structured engine output into one concise, personalized user
  message (email/UI) — nothing more.
- **Trigger:** After the Materiality Evaluator says "surface this."
- **Inputs:** The engine's structured result (number, range, the one decision,
  what changed) + the user's name/context.
- **Tools / deterministic functions:** none — it consumes already-computed output.
- **Reasoning responsibilities:** Phrasing only: a clear subject line, the "what
  changed & why," the one move, the number with its range.
- **Outputs:** Alert copy (email subject + body; in-app one-liner).
- **Memory / state:** Stateless.
- **Human approval boundaries:** n/a.
- **Failure modes:** The classic — prose that states a number the engine didn't
  produce; over-alarming or burying the decision.
- **Guardrails:** Copy is generated **from** the structured result and must cite
  the same figures; a **mismatch check rejects any message whose numbers differ
  from the engine's.** Every message carries the range + NFA line.
- **Evaluation cases (3):** (1) numbers in the copy exactly match the engine's
  result. (2) the one decision appears in the first two lines. (3) an "all-clear"
  run produces no alert (composer isn't even called).
- **When confidence is low:** If required fields are missing, fail closed (send
  nothing) rather than improvise a number.

## Component 7 — Skill: Expected-Income Interpreter *(AI parsing — scoped)*

- **Name:** Expected-Income Interpreter.
- **Objective:** Turn unstructured signal about invoices ("Acme paid late," a
  forwarded email) into a structured expected-income update.
- **Trigger:** Manual-feedback trigger (v1); inbound email (fast-follow).
- **Inputs:** The user's message or email text; the current expected-income list.
- **Tools / deterministic functions:** `expected-income.list_expected_income`,
  `expected-income.mark_invoice_late`.
- **Reasoning responsibilities:** Intent parse → which invoice, what status change,
  what new date.
- **Outputs:** A structured `mark_invoice_late(id, +Nd)` / status update proposal.
- **Memory / state:** none beyond the expected-income list.
- **Human approval boundaries:** Confirms the interpreted change before it drives a
  re-plan when ambiguous.
- **Failure modes:** Wrong invoice matched; wrong date parsed.
- **Guardrails:** For v1, only the **manual/free-text path** is built; email
  ingestion (and its larger ambiguity surface) is deferred. Ambiguous parses ask
  rather than assume.
- **Evaluation cases:** ride the Orchestrator evals ("Acme paid late" → correct
  mutation; a vague message → clarifying question).
- **When confidence is low:** Ask which invoice/what date; never guess a mutation.

## Component 8 — Priority Engine *(deterministic service — explicitly NOT an agent)*

Documented here to make the boundary unmissable. The custom **Financial State +
Priority Engine MCP** owns: goal config, the allocation waterfall (Taxes → Runway
→ Pay → Savings → Debt), floor enforcement, tax computation via the tax-rule
source, balance reconciliation, projections, and the correction log. It is a
service the agent calls. It has no LLM in it. **This is where financial truth
lives, and it is deterministic on purpose** — so the number is reproducible and a
demo (or an audit) can verify it by hand.

---

## Component 9 — Skill: Document Intake *(DEFERRED — post-capstone)*

Designed-for, **not built for v1.** A vision/OCR skill that extracts structured
facts from statements, invoices, or receipt photos. Deliberately deferred because
it introduces a dangerous new failure surface — **an OCR error would feed a wrong
financial fact into the number**, the exact "wrong number destroys trust" risk —
and it satisfies no acceptance bar. The architecture accommodates it later (it
would write proposed facts through the same confirm-before-commit path as the
Transaction Interpreter), but it stays out of the build to keep the MVP narrow.

## The one-paragraph summary for the write-up

Headroom has exactly **one agent** — an orchestrator that owns the messy
boundary between the real world and a deterministic Priority Engine. It wields a
set of skills, none of which touch the number: a **Transaction Interpreter** (the
one genuinely AI-hard task — classifying ambiguous deposits and expenses with
evidence), an **Expected-Income Interpreter** (parsing "Acme paid late" into a
state change), the **Cashflow Synthesizer** (the engine call plus a plain-language
explanation), a **Materiality Evaluator** (deterministic-first gate for earned
silence), and an **Alert Composer** (one concise message). The **Re-planner** is
the agent re-running the Synthesizer when reality moves; **Document Intake** is
designed-for but deferred. Every figure is computed deterministically and
reproducibly by the engine; the model never invents or overrides a financial
fact. Strip the LLM out and the product collapses on real commingled data — which
is the proof the AI is load-bearing, not ornamental.
