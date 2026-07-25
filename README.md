# Headroom

The first decision engine in an **autonomous financial decision system for
one-person and very small service businesses.** It continuously answers and
defends one high-stakes question:

> **How much can I safely pay myself right now?**

```
"$3,650 — the most you can pay yourself this period and stay tax-safe through
Q3, with runway holding above your floor even if Acme pays 30 days late."
```

Forward-looking (forecasts the breach, not just the past), tax-aware (estimated
taxes set aside first), conservative (the promised number is the low end of a
range), and explained (every figure carries its assumption).

## The problem

Salaried people budget against a fixed paycheck; freelancers can't. Income is
lumpy, and every incoming dollar is contested by obligations that move weekly —
quarterly estimated taxes (the silent killer), runway, owner pay, debt,
savings. When an invoice slips or a surprise cost lands, the allocation is
silently wrong, and the freelancer either re-does the mental math or doesn't —
and gets a tax bill they can't cover. Existing tools are dashboards built for
fixed income: they show the past and make the user re-decide.

The structural wrinkle that makes this hard: a sole proprietor usually runs
personal and business money through **one commingled account**. Telling client
income apart from transfers, refunds, repayments, and loan proceeds is where
every downstream number lives or dies — and it isn't solvable by rules. That's
why the product needs AI, and why it's built for the freelancer with a messy
account rather than only the disciplined one who least needs it.

## Who it's for

Sole-proprietor (Schedule C) freelancers with lumpy income, quarterly estimated
taxes, no bookkeeper, and one commingled account. S-corp owners, multi-member
entities, and anyone needing actual filing are explicitly out of scope for v1 —
a Schedule C assumption would silently produce the wrong number for them.

## How it works

**One orchestrating agent, one deterministic engine, a handful of skills.**
Financial arithmetic — allocation, floor enforcement, tax math, projections —
must be exactly reproducible, so it lives entirely in a deterministic engine,
never in the model. The agent owns the messy boundary between the real world
and that engine: interpreting triggers and user messages, classifying
ambiguous transactions, deciding which single decision (if any) is worth
surfacing, and narrating the result.

```
TRIGGERS                    ORCHESTRATING AGENT               MCP SOURCES
 cron schedule      ──▶      • interpret trigger/message   ──▶ Aggregator (bank data)
 txn webhook        ──▶      • classify unclear txns       ──▶ Tax-rule (rates, due dates)
 manual feedback    ──▶      • decide: surface or stay quiet──▶ Expected-income (invoices)
 threshold breach   ──▶      • compose the one alert        ──▶ Financial State + Priority
                                                                 Engine (★ custom, deterministic)
```

**Skills the agent wields** (none of which compute or override a financial
figure):

| Skill | Role |
|---|---|
| **Transaction Interpreter** | Classifies ambiguous deposits and expenses with a confidence score + evidence — the genuinely AI-hard task |
| **Cashflow Synthesizer** | Deterministic engine call + a plain-language explanation of the result |
| **Re-planner** | The agent re-invoking the Synthesizer on changed state and surfacing the one decision |
| **Materiality Evaluator** | Deterministic-first gate deciding whether a change deserves the user's attention (earned silence) |
| **Alert Composer** | Turns engine output into one concise user message |
| **Expected-Income Interpreter** | Parses free-text signal ("Acme paid late") into a structured state change |
| **Document Intake** *(deferred)* | Vision/OCR extraction from statements — designed for, not built for v1 |

The model never invents or overrides a financial fact — it proposes, the
engine computes, and low confidence escalates to the user. Bias to ask on
high-magnitude, low-confidence deposits: mislabeling a transfer as income
inflates the number and can push a user into a tax hole.

## Scope

**In scope:** bank connect + backfill, AI income classification with one-tap
confirm, deterministic priority waterfall (Taxes → Runway → Pay → Savings →
Debt) with hard floors, conservative Schedule C tax estimate, the Safe-to-Pay
Number with range and reasoning, background re-planning, earned attention
(one decision or silence).

**Out of scope for now:** money movement (read + recommend only), live
invoicing integrations, S-corp support, real bank data on stage, a full
multi-state tax matrix, learned/ML spend prediction, broader decision-system
features (collections, hiring, pricing).

## Trust & safety

Read + recommend only — never moves money, files, or gives advice. Every
figure is a range with its assumption stated; the promised number is always
the conservative end. Not financial or tax advice — estimates to confirm with
an accountant.

## Docs

| Doc | What's in it |
|---|---|
| [Executive one-pager](docs/onepager.md) | The one-page pitch: problem, hero output, solution, differentiation |
| [PRD v2](docs/PRD-v2.md) | Full product requirements, canonical demo scenario, acceptance bars, architecture, milestones |
| [AI agent design](docs/ai-agents.md) | Agent/engine/skills architecture and the AI-vs-deterministic boundary in detail |
| [Data model](docs/data-model.md) | Entity-relationship diagram: versioned state, transaction classification, and per-plan input lineage |
| [Personas](docs/personas.md) | Primary and secondary user archetypes, market frame, what's grounded vs. assumed |
| [Falsifiable hypotheses](docs/hypotheses.md) | Every assumption behind the product, written to be killed, with thresholds and pre-committed decisions |

## Status

In build toward a capstone Demo Day (2026-08-14). See the [PRD](docs/PRD-v2.md)
for the acceptance bars, milestones, and demo script.
