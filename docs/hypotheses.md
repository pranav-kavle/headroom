# Headroom — Falsifiable Hypotheses & Validation Plan

*v2 · 2026-07-11 · Companion to PRD v2, Personas, and the Executive Brief*

## Discipline

Every hypothesis below is written to be **killed**. Each states an assumption, a
test, the **observable behavior** we'll measure (not opinions — behavior), an
explicit **success threshold** and **failure threshold**, and the **decision** we
commit to in advance for each outcome. A hypothesis without a failure threshold
and a pre-committed decision is not a hypothesis — it's marketing.

Two rules we hold ourselves to:
- **Stated intent doesn't count.** "I would pay for that" is not evidence; a
  commit, a connection, or an action taken is.
- **Test the cheapest existential risk first.** Don't build to answer a question
  an interview or a spreadsheet can answer.

Sample sizes are small-n by design (early validation, not statistical proof). The
thresholds are decision-triggers, not confidence intervals.

---

## Priority by existential risk (test in this order)

Ranked by *"if false, is there still a company?"* — and, at equal risk, by cost to
test. This is the recommended test sequence.

| Order | ID | Hypothesis (short) | If false… | Cost | Maps to |
|---|---|---|---|---|---|
| 1 | **P1** | Owner-pay uncertainty is frequent & severe | No wedge; stop | Cheap (interviews) | Gate 1 |
| 2 | **P2** | It's more painful than adjacent finance tasks | Wrong wedge; re-aim | Cheap (interviews) | Gate 1 |
| 3 | **A1** | Commingled income can be classified to a safe accuracy bar | The number is unsafe; can't automate the catch | Medium (data test) | Gate 3 |
| 4 | **T1** | Users will connect a commingled bank account | Product can't run | Medium (concierge signups) | Gate 2 |
| 5 | **B1** | Users *act* on the number, don't just re-check it | You're a dashboard, not an agent | Medium (concierge) | Gate 2 |
| 6 | **C1** | Users will pay recurring for prevention | No business model | Medium (concierge commit) | Gate 2 |
| 7 | **T2–T4, B2–B4, P3** | Trust/behavior mechanics work | Fixable design problems | Low–Med (concierge) | Gate 2 |
| 8 | **C2, D1** | "The catch" converts; accountants distribute | Growth/CAC problem, not existential | Medium | Post-Gate 2 |
| 9 | **E1–E3** | Expansion & system-of-action | Smaller company, still viable | Defer | Post-capstone |

**Cheapest path to the next fatal flaw:** 8–12 problem interviews (P1, P2, P3) →
a classifier accuracy test on real anonymized statements (A1, needs no live users)
→ a 5-user concierge MVP (T1–T4, B1–B4, C1) → a real pricing commit at the value
moment (C1, C2) → accountant-channel probe (D1). Expansion (E) is deliberately
last.

---

## Problem hypotheses

### P1 — Owner-pay uncertainty is frequent enough to matter *(most existential)*
- **Assumption:** The primary persona faces the "how much can I pay myself?"
  decision at least monthly, with real uncertainty each time.
- **Why it matters:** If it's a once-a-quarter annoyance, there's no recurring
  hook and no recurring price.
- **Test:** 8–12 problem interviews with the primary archetype.
- **Target participant:** Sole-prop Schedule C freelancers, irregular income, no
  bookkeeper, commingled account.
- **Observable behavior:** Unprompted description of re-deciding pay; how recently
  they last did it; whether they can show a spreadsheet/mental process.
- **Success threshold:** ≥70% describe the decision as monthly-or-more-frequent
  **and** describe active uncertainty (not a fixed number).
- **Failure threshold:** ≤30% — the pain is episodic, not recurring.
- **Decision:** Success → proceed to the concierge test. Failure → **kill or
  re-aim** the wedge (the whole thesis rests here).

### P2 — The problem is more painful than adjacent financial tasks
- **Assumption:** "Safe to pay myself" outranks bookkeeping, invoicing, expense
  tracking, and tax filing in felt pain.
- **Why it matters:** If an adjacent task is sharper, that's the real wedge.
- **Test:** Forced-rank exercise in the same interviews (rank 5 tasks by
  dread/frequency).
- **Target participant:** Same as P1.
- **Observable behavior:** Where "deciding my pay / will I have enough for taxes"
  lands in the forced ranking.
- **Success threshold:** Top-2 for ≥60% of participants.
- **Failure threshold:** Top-2 for ≤30%.
- **Decision:** Success → keep the hero framing. Failure → **re-aim** the hero
  output at whichever task ranks highest (e.g., the tax-bomb tracker leads instead).

### P3 — Tax/cash-flow surprises cause meaningful negative consequences
- **Assumption:** Surprises produce real harm (penalties, scrambling, debt,
  skipped pay), not just mild irritation.
- **Why it matters:** Severity drives willingness to pay for prevention.
- **Test:** Interview recall of the last surprise and its consequence.
- **Target participant:** Same as P1.
- **Observable behavior:** A concrete recent incident + what it cost (money, time,
  stress, a skipped paycheck).
- **Success threshold:** ≥50% recount a specific incident with a tangible cost in
  the last 12 months.
- **Failure threshold:** ≤20% can name any real consequence.
- **Decision:** Success → prevention framing holds. Failure → soften the "villain"
  framing; the product may be a vitamin, not a painkiller.

---

## Behavior hypotheses

### B1 — Users act on the Safe-to-Pay Number *(dashboard-vs-agent test)*
- **Assumption:** When shown the number, users pay themselves that amount (or
  close) rather than ignore it or redo the math.
- **Why it matters:** Acting = an agent that owns an outcome. Re-checking = a
  dashboard. This is the product thesis.
- **Test:** Concierge MVP — manually compute 5 users' number weekly; observe what
  they actually pay.
- **Target participant:** 5 primary-archetype users who've shared exported data.
- **Observable behavior:** Actual pay/transfer amount vs. the recommended number;
  whether they rebuilt their own calc first.
- **Success threshold:** ≥3 of 5 act on the number within a cycle **without**
  rebuilding their own calculation.
- **Failure threshold:** ≥3 of 5 sanity-check by redoing the math themselves.
- **Decision:** Success → the agent thesis holds; automate. Failure → **you're a
  dashboard**; rework toward trust/explanation or reconsider the thesis.

### B2 — Users won't simply recalculate everything themselves
- **Assumption:** Users delegate the math rather than treat the tool as a
  double-check.
- **Why it matters:** Delegation is the value; verification is a feature they'll
  churn from once bored.
- **Test:** Same concierge; track self-recalculation over 4 weeks.
- **Observable behavior:** Frequency of users producing their own competing number.
- **Success threshold:** Self-recalculation drops week-over-week for ≥3 of 5.
- **Failure threshold:** Self-recalculation stays flat/high for ≥3 of 5.
- **Decision:** Success → trust is compounding. Failure → diagnose the trust gap
  (see T-series) before automating.

### B3 — Users prefer proactive alerts to checking a dashboard
- **Assumption:** "Tell me when something matters" beats "I'll go look."
- **Why it matters:** Earned attention is the anti-dashboard posture and the
  retention mechanic.
- **Test:** Concierge — deliver via a proactive message; measure engagement with
  proactive vs. self-initiated checks.
- **Observable behavior:** Open/response rate on "the catch" messages vs.
  unprompted logins.
- **Success threshold:** ≥60% of consequential alerts get a response; proactive
  drives more action than self-checks.
- **Failure threshold:** Alerts ignored (<25% response) or users only engage when
  they choose to look.
- **Decision:** Success → keep earned-attention model. Failure → rethink the
  delivery/notification design.

### B4 — Users will correct uncertain classifications
- **Assumption:** When asked "is this $4,200 client income or personal?", users
  will answer.
- **Why it matters:** Corrections are the safety mechanism (and the correction
  log). If users won't label, low-confidence deposits stay unresolved and the
  number stays unsafe.
- **Test:** Concierge — present 2–3 low-confidence deposits per user; measure
  response.
- **Observable behavior:** Confirmation rate and latency on classification prompts.
- **Success threshold:** ≥70% of low-confidence prompts answered within a cycle.
- **Failure threshold:** ≤40% answered.
- **Decision:** Success → the ask-on-uncertainty design works. Failure → reduce
  prompt burden (better auto-classification, batching) or the safety model breaks.

---

## Trust hypotheses

### T1 — Users will connect/share sufficient financial data *(existential)*
- **Assumption:** The primary will grant read access to a commingled account (or
  export statements) for an early-stage product.
- **Why it matters:** No data, no product.
- **Test:** Concierge recruitment — ask for read-only connection/export.
- **Observable behavior:** Connection/export completion rate among interested users.
- **Success threshold:** ≥50% of interested users complete data-sharing.
- **Failure threshold:** ≤20% — the trust/onboarding barrier is fatal at this stage.
- **Decision:** Success → proceed. Failure → address trust (brand, security proof,
  narrower read scope) before anything else; possibly rethink data model.

### T2 — Ranges and stated assumptions improve trust
- **Assumption:** Showing a range + "why" builds more confidence than a single
  confident number.
- **Test:** Show two versions (point estimate vs. range+assumption); ask which they
  trust and would act on.
- **Observable behavior:** Preference and stated willingness to act.
- **Success threshold:** ≥60% prefer and act on the range+assumption version.
- **Failure threshold:** Majority find ranges confusing / want a single number.
- **Decision:** Success → keep calibrated honesty. Failure → simplify the primary
  display (range on demand, not by default).

### T3 — Conservative recommendations are accepted, not seen as unhelpful
- **Assumption:** Under-promising (recommend less pay, over-reserve taxes) reads as
  trustworthy, not stingy.
- **Test:** Concierge — observe reaction when the number is deliberately conservative.
- **Observable behavior:** Do they accept the conservative number or push back /
  override upward repeatedly?
- **Success threshold:** ≤1 of 5 repeatedly overrides the conservative number upward.
- **Failure threshold:** ≥3 of 5 consistently override upward (conservatism reads
  as useless).
- **Decision:** Success → keep conservative bias. Failure → expose an adjustable
  risk tolerance rather than a fixed conservative stance.

### T4 — Users understand estimates ≠ tax advice
- **Assumption:** Users grasp the NFA boundary and don't treat the number as filed
  tax counsel.
- **Why it matters:** Reliance risk and liability.
- **Test:** Post-use comprehension check.
- **Observable behavior:** Can they articulate that figures are estimates to
  confirm with an accountant?
- **Success threshold:** ≥80% correctly state the boundary.
- **Failure threshold:** ≤50%.
- **Decision:** Success → posture holds. Failure → strengthen disclaimer UX; **do
  not ship the automated catch** until comprehension clears (with counsel review).

---

## Commercial hypotheses

### C1 — Users will pay recurring for prevention & monitoring *(existential)*
- **Assumption:** The primary will pay ~$15–30/mo for ongoing control and fewer
  surprises.
- **Why it matters:** No recurring willingness = no business.
- **Test:** Ask for a **real commit** (pre-pay or card-on-file) at the value moment
  in the concierge, not a survey.
- **Observable behavior:** Actual commits, not stated intent.
- **Success threshold:** ≥2 of 5 concierge users commit real money after feeling
  the value.
- **Failure threshold:** 0 of 5 commit despite positive sentiment ("nice but
  wouldn't pay").
- **Decision:** Success → pricing thesis holds; set the point within the band.
  Failure → **kill or rethink** monetization (free tool + different model?).

### C2 — A user who has experienced "the catch" is more willing to pay
- **Assumption:** Living through a prevented surprise raises willingness to pay
  vs. a cold pitch.
- **Test:** Compare commit rate of users who experienced a catch vs. those who
  didn't (within/adjacent to the concierge).
- **Observable behavior:** Commit rate, catch cohort vs. no-catch cohort.
- **Success threshold:** Catch cohort commits at ≥2× the no-catch rate.
- **Failure threshold:** No meaningful difference.
- **Decision:** Success → make "engineer an early catch" the activation strategy.
  Failure → the catch is a demo device, not an activation lever; find another.

### D1 — Accountants/bookkeepers are a viable distribution channel
- **Assumption:** Accountants will refer clients (offloads the between-tax-time
  questions they don't want).
- **Test:** 5–8 accountant conversations; ask for a referral commitment or pilot.
- **Observable behavior:** A concrete referral / willingness to co-pilot, not
  polite interest.
- **Success threshold:** ≥2 give a specific referral or agree to a pilot.
- **Failure threshold:** 0 move past polite interest.
- **Decision:** Success → invest in the accountant channel. Failure → rely on
  direct community channels (r/freelance, Discords); revisit later.

---

## Expansion hypotheses *(deliberately last — not existential for the capstone)*

### E1 — Safe-to-Pay leads naturally into adjacent decisions
- **Assumption:** Users who trust the pay number want the same engine on tax
  reserves, runway, expense, and cash-flow decisions.
- **Test:** Concierge exit — which adjacent decision would they want next, and
  would they pay more for it.
- **Observable behavior:** Unprompted pull toward a specific adjacent decision.
- **Success threshold:** ≥50% name an adjacent decision they'd want handled.
- **Failure threshold:** No consistent pull.
- **Decision:** Success → validates the v2 "Deepen" roadmap. Failure → stay
  single-decision longer.

### E2 — The same engine serves a broader group of one-person businesses
- **Assumption:** Very small service businesses (labor-in, invoice-out) fit the
  same state/re-plan engine.
- **Test:** Post-wedge — 3–5 interviews with adjacent service solos.
- **Observable behavior:** Whether the same allocation-collapse pain and engine
  inputs apply without new modeling.
- **Success threshold:** ≥3 of 5 fit without a new engine.
- **Failure threshold:** Most need materially different logic (e.g., payroll, COGS).
- **Decision:** Success → expansion path credible. Failure → the market is narrower
  than the pitch; adjust TAM claims honestly.

### E3 — The product can become a system of action, not just reporting
- **Assumption:** Users will let the agent *execute* a reversible action (fund a
  tax sub-account) with approval — the recommend→act crossing.
- **Test:** Post-trust survey + a later opt-in pilot with a BaaS partner.
- **Observable behavior:** Opt-in rate to let the agent move the set-aside (with
  confirmation).
- **Success threshold:** ≥40% of trusting users opt in to approval-gated execution.
- **Failure threshold:** ≤10% willing to let it move money.
- **Decision:** Success → pursue execution (the real moat test). Failure → remain a
  decision/recommendation layer; moat rests on decision data, not execution.

---

## What this means for the capstone

The capstone should **run P1–P3 (interviews) and A1 (classifier accuracy) before
Demo Day** if at all possible — they're the cheapest existential tests and produce
the real evidence the personas doc currently lacks. **B/C/T** ride the concierge
MVP, which can begin in parallel but is the post-build validation engine. **E** is
explicitly post-capstone. Present the hypotheses and the *plan* to test them as a
deliverable; present P1–P3/A1 *results* if the timeline allows — even n=8 real
interviews beats zero.
