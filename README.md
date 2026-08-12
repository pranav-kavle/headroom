# Headroom

Headroom reads GitHub, Gmail, Calendar, voice notes, and Google Health to extract
every commitment you've made, weighs it against your real capacity, and tells you
each morning what's actually at risk — with the work already drafted.

> "You told Maya you'd send the revised deck Thursday. Thursday has four hours of
> meetings on top of two other deliverables."
> — quoted from the thread it came from, with a link back to it.

**The wedge is commitments vs. capacity**, not "AI chief of staff." The narrow
claim is the testable one: *does Headroom know what you owe, and is it right?*

**Success metric:** commitments closed without opening the source app.

## The core rule — verifiable autonomy

1. **The engine computes. The model extracts and phrases.** No figure, date,
   duration, count, or score is ever produced by the model.
2. **Every claim carries provenance.** A statement about your life is only
   utterable if it traces to a stored artifact with a quote, timestamp, and link.
3. **The model never chooses its own autonomy tier.** Deterministic policy decides
   what may execute.
4. **Voice is STT → text → engine → TTS.** Never speech-to-speech.
5. **When the engine cannot determine something, Headroom asks.**

## Action tiers

| Tier | Contents | Policy |
|---|---|---|
| 1 — Private, reversible | Draft replies, calendar holds, triage/labelling | Unattended, logged, undoable |
| 2 — Outward-facing | Send a reply, decline a meeting, comment on a PR | One tap, always — not togglable |
| 3 — Money & third parties | Purchases, bookings, cancellations | Prepared, never executed |
| 4 — Code | Draft review comments, fix trivial issues, push a branch | Deferred |

Tier 1 autonomy turns on only once extraction clears ≥90% precision on
`owed_by_me`.

## Architecture

One Next.js deployment. The client↔server contract is separated by rule, not by
infrastructure:

```
src/app/(app)/          PWA UI — renders props, holds no business logic
src/app/api/v1/…        the only client<->server surface
packages/contracts/     Zod schemas + inferred types, shared
packages/engine-mcp/    deterministic engine, MCP tools, tested
packages/graph/         Prisma + graph queries — the only Prisma importer
packages/tokens/        design tokens as plain JS objects
```

Three of these boundaries are enforced by tests in `tests/architecture/`, not by
convention.

## Getting started

```bash
npm install
docker compose up -d          # Postgres
npm run prisma:migrate        # apply migrations
npm run dev                   # http://localhost:3000
```

Copy `.env.example` to `.env` and fill in the Clerk keys and
`TOKEN_ENCRYPTION_KEY`.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Every Vitest project: app, contracts, graph, tokens, engine-mcp |
| `npm run build` | Production build (standalone output) |
| `npm run lint` | ESLint |
| `npm run tokens:css` | Regenerate `src/app/tokens.css` from `packages/tokens` |
| `npm run prisma:generate` | Regenerate the Prisma client into `packages/graph` |
| `npm run prisma:migrate` | Create and apply a migration |

Postgres must be running for the `graph` and `engine-mcp` test projects.

## Docs

| Doc | What's in it |
|---|---|
| [Design doc](docs/superpowers/specs/2026-08-11-headroom-commitments-design.md) | The whole product: life graph, extraction eval bar, action tiers, phasing |
| [Plans](docs/superpowers/plans/) | Implementation plans, one per phase |
| [Prototype](prototype/headroom.html) | All 11 screens, static |

## Status

v0 in build: prove extraction is good enough to trust. No push, no voice, no
actions until it is.
