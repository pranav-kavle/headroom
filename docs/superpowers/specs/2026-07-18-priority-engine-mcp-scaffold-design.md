# Priority Engine MCP — Shell & Contracts Design

Status: Approved
Date: 2026-07-18
Traceability: INIT-03 (Financial Decision Engine), EPIC-09 (Financial State + Priority Engine
Core), ST-027, ST-028 — `docs/analysis/pass-3-implementation-backlog.md`

## Purpose

Scaffold the ★ custom-authored MCP server required by Bar 3 (`≥3 MCP sources, ≥1 custom
authored`). This covers the tool contracts and shell only — the underlying tax/waterfall/
forecasting math (EPIC-10, EPIC-11, EPIC-12) is out of scope and is stubbed where the tool
contract depends on it.

Per the AI/deterministic boundary rule (`CLAUDE.md`, project skill): this server is the *only*
place a financial figure is computed or persisted as authoritative. Nothing here proposes or
narrates — that's the model's job, layered on top.

## Package layout

New npm workspace: `packages/priority-engine-mcp`. Root `package.json` gains a `"workspaces"`
field (`["packages/*"]`).

The Prisma schema is not duplicated. `prisma/schema.prisma` at the repo root remains the single
source of truth (per its own header comment referencing `docs/data-model.md`). The new package
imports the `PrismaClient` class directly from the existing generated output
(`src/generated/prisma`) via a relative path and instantiates its own singleton, mirroring the
pattern in `src/lib/prisma.ts`. No second schema, no second generation step.

```
packages/priority-engine-mcp/
  package.json
  tsconfig.json
  src/
    index.ts              # server entrypoint, stdio transport, tool registration
    db.ts                 # Prisma singleton (imports generated client from ../../../src/generated/prisma)
    tools/
      get-state.ts
      set-goal.ts
      classify-transaction.ts
      record-correction.ts
      compute-allocation.ts   # stub
      get-projections.ts      # stub
    tools/__tests__/
      get-state.test.ts
      set-goal.test.ts
      classify-transaction.test.ts
      record-correction.test.ts
      compute-allocation.test.ts
      get-projections.test.ts
```

## Transport

`@modelcontextprotocol/sdk`'s `StdioServerTransport`. Each caller (a local Claude Code session,
or the headless Agent SDK runner responding to a cron/webhook/manual trigger) spawns this package
as a child process. No auth or networking layer — correctness holds because all state lives in
Postgres, not in server memory, so multiple concurrently-running instances are safe by
construction.

Explicitly deferred: Streamable HTTP via `mcp-handler` (already installed at the repo root, unused
today). Revisit only if a caller emerges that can't spawn a local child process.

## Tool contracts

All inputs/outputs are Zod schemas. Enum values match the Prisma schema exactly
(`BucketKind`, `ClassificationLabel`, `ClassificationCadence`, `FilingStatus`, etc.) — no
re-declaration of the domain vocabulary.

### `get_state` (real)

- **Input:** `{ userId: string }`
- **Output:**
  ```
  {
    goalConfig: { id, versionNo, effectiveFrom, bucketTargets: [{ bucketKind, priorityOrder, targetAmount, isFloor, floorAmount }] } | null,
    taxProfile: { id, versionNo, taxYear, filingStatus, taxTreatment, residentTaxJurisdiction, effectiveFrom } | null,
    balances: [{ accountId, balance, asOf, source }],
    latestPlan: { id, planStatus, safeToPayLow, safeToPayHigh, promisedNumber, taxBombStatus, createdAt } | null
  }
  ```
- Reads the current (`isCurrent: true`) `GoalConfig`+`BucketTarget` rows, current `TaxProfile`,
  the latest `AccountBalanceSnapshot` per account owned by the user, and the most recent `Plan`.
  Returns `null` for any section that doesn't exist yet (a brand-new user has no goal config, no
  plan) — this is a valid state, not an error.

### `set_goal` (real)

- **Input:** `{ userId, effectiveFrom: string (ISO date), bucketTargets: [{ bucketKind, priorityOrder, targetAmount, isFloor, floorAmount? }] }`
- **Output:** `{ goalConfigId, versionNo }`
- Atomically: flips the prior current `GoalConfig.isCurrent` to `false`, inserts a new
  `GoalConfig` (versionNo incremented) with its `BucketTarget` rows, `isCurrent: true`.

### `classify_transaction` (real)

- **Input:** `{ transactionId, label, cadence?, confidence?: number (0-1), evidence?: json }`
- **Output:** `{ classificationId, reviewState: 'pending' | 'confirmed' }`
- Writes a `TransactionClassification(source: 'model')` row, superseding the prior current
  classification for that transaction if one exists (`supersedesId` chain, prior `isCurrent`
  flipped to `false` in the same transaction).
- Applies the confidence-threshold policy: exposes an exported `CONFIDENCE_THRESHOLD` constant
  (default `0.8`) with a comment marking it **provisional — the real value is an open decision
  pending the Sprint-0 spike** (`pass-2-solution-definition.md` §7, `pass-4-implementation-review.md`
  §8). Below the threshold, `reviewState` is always `pending`, never `confirmed` — this is the
  "bias to ask on high-magnitude, low-confidence deposits" rule (BRULE-005) enforced structurally,
  not left to the model's judgment.

### `record_correction` (real)

- **Input:** `{ classificationId, label, cadence?, checkInId? }`
- **Output:** `{ classificationId }`
- One transaction: writes a new `TransactionClassification(source: 'user', supersedesId: <old
  id>, reviewState: 'corrected', isCurrent: true)`, flips the prior row's `isCurrent` to `false`,
  and — if `checkInId` is provided — sets `CheckIn.resultingClassificationId` in the same
  transaction. No partial writes under any failure path (ties to the existing partial-unique
  `isCurrent` constraint in the migration, which prevents two current rows from coexisting even
  under a concurrent-write race).

### `compute_allocation` (stub)

- **Input:** `{ userId, agentRunId, triggerContext? }`
- **Output when implemented:** `{ planId, safeToPayLow, safeToPayHigh, promisedNumber, taxBombStatus, warnings: [...] }`
- **Now:** validates the input shape, then throws a structured MCP tool error:
  `"compute_allocation is not yet implemented — depends on EPIC-11 (Allocation Waterfall & Safety
  Floors, ST-031/032/033/034)."` Never returns a fabricated or placeholder number — a wrong number
  here is flagged in the backlog's own risk register (R-001) as the single most damaging possible
  defect, so failing loudly is the only acceptable stub behavior.

### `get_projections` (stub)

- **Input:** `{ userId, planId? }`
- **Output when implemented:** `{ projections: [{ kind, low, high, point, assumption }] }`
- **Now:** same pattern — throws `"get_projections is not yet implemented — depends on EPIC-12
  (Income & Spend Forecasting, ST-036)."`

## Testing

Adds Vitest to the new package (no test runner exists anywhere in the repo yet). Contract tests
run against the real dev Postgres via the shared Prisma client — no mocking the database. Each
test creates its own fixture rows and cleans up after itself (no reliance on prior demo-persona
seed data).

Covers the ST-027/ST-028 acceptance criteria that don't require the unbuilt math:
- `get_state` returns `null` sections gracefully for a fresh user.
- `set_goal` correctly supersedes the prior current `GoalConfig` version.
- `classify_transaction` respects the confidence threshold (both branches: above/below).
- `record_correction` is atomic, including the concurrent-write race case (two corrections to the
  same transaction — the partial-unique constraint must prevent two current rows).
- `compute_allocation` / `get_projections` throw the documented not-implemented error rather than
  silently succeeding.

Determinism (`compute_allocation` called twice with identical inputs → identical
`output_digest`) is explicitly **not** testable yet, since it requires the real waterfall — deferred
to EPIC-11's own test suite (ST-031-T4).

## Out of scope

- Real `compute_allocation` / `get_projections` logic (EPIC-10, EPIC-11, EPIC-12).
- Auth or network transport (Streamable HTTP / `mcp-handler`) — stdio only, per the transport
  decision above.
- `Plan.inputDigest` / `outputDigest` computation — only meaningful once `compute_allocation` is
  real.
- Resolving the confidence-threshold open decision — the Sprint-0 spike is a separate, tracked
  piece of work; this scaffold only wires the constant in behind a clearly-marked placeholder.
