---
name: cashflow-companion-context
description: Use when working on the Cashflow Companion codebase — covers architecture, AI/deterministic boundary, Demo Day acceptance bars, canonical scenario, MCP sources, and key constraints
---

# Cashflow Companion — Project Context

## Overview
Financial decision engine for freelancers (sole-prop Schedule C) answering "How much can I safely pay myself?" Demo Day: **Aug 14, 2026**. Current week: W4 (Jul 14–20).

## Architecture: One agent + one engine + skills

**Never add a second decision-making agent.** Multiple agents reasoning over money = inconsistent numbers = trust destroyed.

| Component | Role |
|---|---|
| **Orchestrating Agent** (only true agent) | Interprets triggers/messages, routes unclear transactions, selects the one decision to surface |
| **Priority Engine MCP** ★ custom-authored ★ | ALL financial arithmetic: allocation waterfall, tax math, floor enforcement, projections |
| **Named Skills** | Perception/communication layers — none touch the number |

## Critical Rule: AI/Deterministic Boundary

**The model NEVER computes or overrides a financial figure.** It proposes; the engine computes.

| AI owns | Engine owns |
|---|---|
| Classify ambiguous transactions with confidence + evidence | Arithmetic, allocation, floor enforcement |
| Parse "Acme paid late" → structured state change | Tax math, due-date calculation |
| Narrate one decision in plain language | Balance reconciliation, scenario math |
| Rank competing material changes (tiebreaker only) | Projection ranges |

**Falsifiability test:** strip the LLM — if the product still works on demo data, AI is ornamental. It's load-bearing only if the product collapses on real commingled data without the Transaction Interpreter.

## Canonical Scenario (single source of truth — never use other numbers)

- **Persona:** Dev, freelance dev, Schedule C, single, CA · **Balance:** $11,900 · **As of:** Sep 3, 2026
- **Q3 tax due Sep 15** (12 days out) · gap $900 · runway floor $6,000
- **Acme slips 30 days (the catch):** Safe-to-Pay = **$3,650** (range $3,650–$5,050)
- **Derivation:** `clamp(11,900 + 2,800 − 4,150 − 900 − 6,000, 0, 6,000) = $3,650`
- Waterfall: taxes top-up $900 → runway $6,000 → pay $3,650 → savings $0 → debt $0

## Demo Day Acceptance Bars

| # | Bar | Status |
|---|---|---|
| 1 | Goal config end-to-end (tax profile, runway floor, target pay, savings, debt, priority) | W2 |
| 2 | Background agentic re-planning, 3 trigger types (cron / webhook / manual) | W4–W5 |
| 3 | ≥3 MCP sources, ≥1 custom authored (4 shipped) | W2–W3 |
| 4 | ≥2 multimodal outputs: dashboard + PDF + email | W4–W6 |
| 5 | ≥2 named Skills + ≥3 evals each; Synthesizer dual-invoked (Claude Code + headless runner) | W3–W5 |
| 6 | Live deploy, HTTPS, Clerk, cost cap | W5 + W8 |
| 7 | Langfuse traces + spend ceiling on every agentic loop | W7 |

## Must-Build Skills (14 core evals = green gate)

| Skill | Evals | Notes |
|---|---|---|
| Transaction Interpreter | 5 | The AI moment — confirm visibly moves the number |
| Cashflow Synthesizer | 5 | Engine call + AI explanation; dual-invoked (Bar 5) |
| Re-planner | 4 | Orchestrator re-running Synthesizer on changed state |
| Materiality Evaluator | 3 | If time — deterministic-first, AI tiebreaker only |
| Alert Composer | 3 | If time — copy must match engine numbers exactly |

## MCP Sources (Bar 3)

1. **Aggregator** (Plaid) — `get_transactions`, `get_balances`, `get_accounts`
2. **Tax-rule** — `get_tax_rules(filing_status, state, year)`, `get_due_dates(year)`
3. **Expected-income** — `list_expected_income`, `mark_invoice_late`
4. **Financial State + Priority Engine** ★ — `get_state`, `set_goal`, `compute_allocation`, `classify_transaction`, `record_correction`, `get_projections`

## Tech Stack
Next.js · TypeScript · Prisma/Postgres · Clerk (auth) · Langfuse (tracing) · Agent SDK (TS headless runner) · MCP servers (TS/Python) · Plaid (aggregator, demo off scripted/sandbox data)

## Safety Rules (non-negotiable)
- Tax set-aside and runway floor funded **before** optional buckets — always
- High-magnitude, low-confidence deposits: **ask, never assume** (a wrong label inflates Safe-to-Pay → tax hole → trust destroyed)
- Every figure is a range; the promised/quoted number is the conservative (low) end
- NFA posture: "organizes your own data and shows tradeoffs — not tax or financial advice"
- Stale/broken feed: **flag, never go silently wrong**

## Cut Order (if schedule slips)
Alert Composer → Materiality Evaluator → scheduled-trigger polish → PDF styling → windfall persona → seasonal spend detail

**Never cut:** interpreter-confirm moment, $3,650 re-plan, tax-math validation.
