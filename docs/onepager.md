# Headroom — Executive Brief

*One-page product brief · v2 · 2026-07-11*

**One-liner.** The first decision engine in an **autonomous financial decision
system for one-person and very small service businesses** — it continuously
answers and defends one high-stakes question: *how much can I safely pay myself
right now?*

**Problem.** Salaried people budget against a fixed paycheck; freelancers can't.
Income is lumpy, and every incoming dollar is contested by obligations that move
weekly — quarterly estimated taxes (the silent killer), runway, owner pay, debt,
savings. When an invoice slips or a surprise cost lands, the allocation is
silently wrong, and the freelancer either re-does the mental math (exhausting,
weekly) or doesn't — and gets a tax bill they can't cover. Existing tools are
dashboards built for fixed income: they show the past and make you re-decide.

**Initial target user.** Sole-proprietor (Schedule C) freelancers: lumpy income,
quarterly estimated taxes, no bookkeeper, one commingled personal/business
account, decisions made alone. *Out of scope for v1:* S-corp and multi-member
entities — a different tax shape a Schedule C number would get wrong.

**Core insight.** The hard part isn't display — it's that a sole-prop runs
personal and business money through **one account**, so telling client income
from transfers, refunds, repayments, and loan proceeds is where every downstream
number lives or dies, and it can't be solved by rules. This is why the product
needs AI, and why it works for the real freelancer with a messy account rather
than only the disciplined one who least needs it.

**Hero outcome — the Safe-to-Pay Number.**

> *"$3,650 — the most you can pay yourself this period and stay tax-safe through
> Q3, with runway holding above your floor even if Acme pays 30 days late."*

Forward-looking (forecasts the breach), tax-aware (taxes set aside first),
conservative (the promised number is the low end of the range), explained (every
figure is a range with its assumption stated).

**Solution.** Reads bank data → **AI classifies which deposits are real income**
(with a confidence score; asks when unsure) → a **deterministic engine** allocates
against a priority waterfall (Taxes → Runway → Pay → Savings → Debt) with hard
floors → produces and defends the number → **re-plans in the background** when
reality changes → surfaces the single decision that matters, and stays silent
otherwise.

**What makes it AI-native.** The AI owns the messy boundary between the real
world and a deterministic engine. It turns ambiguous, unstructured signal (a
commingled deposit; "Acme paid late") into the clean, confidence-scored inputs
the engine needs, chooses *which one* decision to surface, and writes the alert —
while all arithmetic, tax rules, and floor enforcement stay deterministic. **The
model never invents or overrides a financial fact.** Falsifiability test we hold
ourselves to: strip the LLM out and the product collapses on real commingled data.

**Why now.** The solo/freelance economy is at scale; bank aggregation
(Plaid/Teller) is commoditized; and LLMs are only now good enough to classify
messy real-world transactions and translate plain-language feedback into
structured state — the missing piece that made this impossible to build before.

**Differentiation.** Not a dashboard (forward-looking, not reconciliation); not a
chatbot (it owns an outcome instead of answering questions); not a one-off
calculator (a standing agent that re-decides when reality moves). It competes on
the **intelligence layer above any bank account**, not on money movement (already
commoditized by Found, Lili, Novo).

**Trust & safety boundaries.** Read + recommend only — never moves money, files,
or gives advice. Conservative estimates shown as ranges with "confirm with your
accountant." Biases to *ask* on high-magnitude, low-confidence deposits rather
than guess. Schedule C only, with signup gated on filing structure. Strictly NFA
posture; counsel review of the disclaimer before the tax engine is trusted for
real users.

**MVP scope.** The core loop above, for sole-prop Schedule C, on federal + 1–2
states, with manual expected-income (no live invoicing), no money movement, and
no learned spend-prediction model.

**Long-term direction.** **v1 Decide** (this build) → **v2 Deepen** (tax reserves,
runway protection, cash-flow planning, expense decisions — reusing data already
held) → **v3 Act** (auto-fund the tax sub-account via a BaaS partner, with
approval — the recommend→execute crossing) → **v4 Expand** (invoice collections,
hiring affordability, project pricing; market widens to very small service
businesses).

**Critical validation questions.** (1) Is owner-pay uncertainty frequent and
painful enough that people will pay to relieve it? (2) Do users *act* on the
number, or re-check it themselves — the difference between an agent and a
dashboard? (3) Can we classify commingled deposits to a precision/recall bar safe
enough to automate the catch? (4) Is the Schedule C tax engine right against real
filed returns? (5) Will users pay recurring for prevention — and does living
through "the catch" convert them?

---

*Read + recommend only. Estimates, not tax or financial advice — confirm with
your accountant.*
