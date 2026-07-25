# Headroom — Personas

*v2 · 2026-07-11 · Companion to PRD v2 and the Executive Brief*

## How to read this document

These are **evidence-oriented archetypes**, not marketing characters. Two kinds
of statement appear, and they are labeled so a reviewer can tell them apart:

- **[Grounded]** — supported by public data (cited at the end).
- **[Assumption → validate]** — a plausible behavioral hypothesis that has **not**
  been tested with real users. Each maps to a test in the Hypotheses doc.

**No customer interviews have been conducted yet.** Nothing here is a real quote
or a real research finding. The behavioral, pain-ranking, and willingness-to-pay
claims are exactly what the validation plan exists to confirm or kill. Where a
persona's core depends on an untested belief, it is flagged inline.

## Market frame (disciplined, not inflated)

**[Grounded]** ~27 million nonfarm sole-proprietorship Schedule C returns are
filed in the US (IRS SOI, TY2018; TY2023 tables now published), accounting for
~30M nonfarm businesses. This is the *upper bound* of the addressable pool, not
the serviceable market. **[Assumption → validate]** The initial serviceable
segment is far narrower: sole props with **irregular** income, **quarterly
estimated-tax exposure**, and a **commingled** account — the intersection where
the Safe-to-Pay problem actually bites. We are **not** claiming "all small
businesses"; the expansion path (very small service businesses) is positioning,
not v1 TAM.

**[Grounded]** The pain is structurally real: SE tax is 15.3%; anyone expecting
to owe ≥$1,000 must pay quarterly (Apr 15 / Jun 15 / Sep 15 / Jan 15); the 2026
underpayment penalty runs ~7% annualized. A missed $5,000 payment costs roughly
$350 over a year — plus the cash-flow shock of a bill you didn't reserve for.

---

## PRIMARY PERSONA — "The lumpy-income solo pro"

*Archetype represented in the demo by **Dev** (freelance developer, Schedule C,
CA). Also fits designers, writers, developers, marketers, coaches billing
project + retainer work.*

**Snapshot.** One person. Income arrives in uneven chunks — a retainer plus
project deposits that land early, late, or not when promised. Files (or knows they
should file) quarterly estimated taxes. No bookkeeper, or one who appears only at
tax time. Runs personal and business money through **one account**.

**Jobs to be done.**
- *Functional:* "Tell me the largest amount I can pay myself this period without
  creating a tax or runway problem later."
- *Emotional:* "Stop the weekly dread and the mental re-math every time money moves."
- *Social:* "Feel like I'm running a business, not improvising."

**Current workflow. [Assumption → validate]** A spreadsheet (or mental model) +
the bank app + a vague "I think I owe taxes?" worry. Re-does the allocation by
hand whenever a deposit lands or an invoice slips; often defers the tax set-aside
because this month's pay feels more urgent.

**Triggering moments.** A client invoice slips 30 days · a surprise expense · a
quarterly deadline approaching with the reserve short · a big deposit landing (is
this "mine" or the tax's?) · deciding this month's pay.

**Most painful decisions. [Assumption → validate]** (1) How much to pay myself
this month. (2) Whether I can afford a purchase/subscription/tool right now. (3)
Whether I've set aside enough for the next quarter. These are believed to be the
sharpest; interviews must confirm the ranking.

**Existing alternatives. [Grounded]** A spreadsheet; the bank app; QuickBooks
Solopreneur / found-style neobanks (which categorize and estimate a tax number
but are backward-looking and fixed-income-shaped); an accountant at tax time;
doing nothing. **[Assumption → validate]** None continuously answer "safe to pay
myself *now*, forward-looking, with a late invoice priced in."

**Reasons to distrust the product. [Assumption → validate]** "It'll mis-read my
deposits and tell me a wrong number." · "It's just another dashboard." · "I don't
want to connect my bank to a startup." · "If the tax figure is wrong, I'm the one
who pays the penalty." These are the trust objections the product's design
(confidence + ask, ranges, conservative bias, NFA) is built to answer — and that
the concierge test must prove are answered.

**Buying motivation. [Assumption → validate]** Prevention and relief: fewer
surprises, less weekly math, confidence in the pay decision. Strongest right after
living through "the catch."

**Adoption barriers.** Bank-connection hesitation · skepticism it's different from
tools they've abandoned · needing a credible number on day one from backfill alone
(a wrong first number = instant uninstall).

**Data-access concerns. [Assumption → validate]** Read-only, no credential
storage, encryption, "you never move my money." Commingled account means the
product sees personal spending too — a real privacy sensitivity to test.

**What success looks like.** Taxes always funded; runway never silently breached;
the pay decision made in seconds, not an evening; zero surprise tax bills.

**What would cause churn.** A wrong number or wrong tax figure (fatal) · nagging
when nothing's wrong (breaks earned attention) · feeling like a dashboard they
must still sanity-check themselves · a scary bank-connection moment.

---

## SECONDARY PERSONA A — "The steady-retainer solo"

*Represented by **Maya** (brand designer, Schedule C, NY).*

**Why secondary, not primary.** **[Assumption → validate]** Mostly-retainer income
is *closer to fixed*, so the acute allocation-collapse pain is milder and existing
tools partly work. Lower urgency → likely a peace-of-mind buyer, not a
pain-driven one; a harder, slower conversion. Useful as an *expansion* segment and
as the demo's "normal month / on-track" contrast, not the wedge.

**Jobs to be done.** "Confirm I'm on track and funding taxes and savings in the
right order" more than "rescue me." **Triggering moments.** Annual/seasonal
charges (e.g., a March tool renewal); occasional project lumps. **Most painful
decisions.** Savings vs. pay optimization; whether a slow month is a problem.
**Existing alternatives.** Monarch/YNAB-style budgeting works *better* here
because income is steadier — a real competitive threat for this segment.
**Distrust.** "I already have this handled." **Buying motivation. [Assumption →
validate]** Optimization and calm, not crisis. **Churn risk.** Sees it as
redundant with a budgeting app.

---

## SECONDARY PERSONA B — "The windfall-prone consultant"

*Represented by **Sam** (consultant, Schedule C, TX).*

**Why secondary.** **[Assumption → validate]** Large one-off project deposits
create a specific, dangerous failure: treating a $20k windfall as recurring
income → over-paying yourself → a tax-and-runway hole next period. Valuable
because it stresses the *windfall-smoothing* and conservative-bias behaviors, but
the population is smaller and the buying trigger episodic.

**Jobs to be done.** "Don't let a big deposit fool me into over-spending; tell me
the honest, smoothed number." **Triggering moments.** A large deposit lands; a
long dry stretch after. **Most painful decisions.** How much of a windfall is
safe to pay/spend vs. reserve. **Existing alternatives.** An accountant for the
big-picture, gut feel in between. **Distrust.** "Will it understand this is
one-off, not a raise?" **Buying motivation. [Assumption → validate]** Avoiding the
post-windfall crash. **Churn risk.** If it ever treats a windfall as recurring —
that single error ends trust.

---

## Explicitly out of scope for the MVP (attractive but wrong)

| Segment | Why it looks attractive | Why it's out for v1 |
|---|---|---|
| **S-corp owners** (reasonable comp + distributions) | Higher income, higher willingness to pay, more tax complexity to relieve | **Different tax shape.** A Safe-to-Pay Number that silently assumes Schedule C would be *wrong* for them — reasonable-comp payroll + distributions is a separate engine. A wrong number here churns your *highest-value* users angry. Signup must gate on filing structure. |
| **Solos with employees/contractors** | Bigger businesses, bigger budgets | Payroll obligations and labor-cost modeling are a new data dependency and a new failure surface; not needed to test the wedge. |
| **Product / inventory businesses** | Larger market | COGS, inventory, and working-capital dynamics the engine doesn't model; "service, no inventory" is the discipline that keeps expansion honest. |
| **Multi-member LLCs / partnerships** | Adjacent | K-1 / pass-through complexity; different filing and allocation logic. |

The through-line: everything out of scope shares one trait — it would make the
Safe-to-Pay Number *silently wrong for someone who trusts it*. That is the one
failure the product cannot afford, so the ICP stays sole-prop Schedule C until the
number is proven trustworthy there.

---

## Segmentation logic (why one primary + two secondaries)

The three share **one engine** (state → classify → forecast → priority → re-plan)
but differ on **income shape**, which is what changes the pain and the sale:

- **Primary (lumpy project/retainer mix):** highest, most frequent pain → the wedge.
- **Secondary A (steady retainer):** milder pain, budgeting-app competition →
  expansion, and the demo's on-track contrast.
- **Secondary B (windfall-prone):** episodic but dangerous pain → stresses
  conservative-bias behaviors.

Building for the primary covers the other two's core needs; building for either
secondary first would soften the wedge.

---

## The honest gap — what must be validated before these personas are "real"

Everything marked **[Assumption → validate]** is currently belief, not evidence.
The load-bearing ones, in priority order (full tests in the Hypotheses doc):

1. **Frequency & severity** of owner-pay uncertainty — is it weekly-painful, or
   occasional-annoying? (If occasional, the wedge is weaker.)
2. **Pain ranking** — is "safe to pay myself" really sharper than adjacent tasks?
3. **Trust-to-action** — do users *act* on the number, or sanity-check it
   themselves (the dashboard failure)?
4. **Data-access willingness** — will the primary connect a commingled bank
   account to an early-stage product?
5. **Willingness to pay** for prevention, and whether "the catch" converts.

**Recommended cheapest first step:** 8–12 problem interviews with the primary
archetype (recruit from r/freelance, freelance Discords/Slacks, and accountant
referrals) to confirm frequency/severity and pain ranking *before* the concierge
trust-to-action test. Replace every **[Assumption → validate]** tag with a real
finding as interviews land.

---

### Sources
- IRS SOI — Nonfarm sole proprietorship statistics: https://www.irs.gov/statistics/soi-tax-stats-nonfarm-sole-proprietorship-statistics
- IRS — Estimated taxes (thresholds, deadlines, safe harbor): https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes
