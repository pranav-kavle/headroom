# Priority Engine MCP Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Priority Engine MCP server as a new npm workspace package with 4 real tools (`get_state`, `set_goal`, `classify_transaction`, `record_correction`) and 2 explicit stubs (`compute_allocation`, `get_projections`) that fail loudly instead of fabricating a number.

**Architecture:** New workspace `packages/priority-engine-mcp`, stdio transport via `@modelcontextprotocol/sdk`, Zod input schemas, Prisma access through the existing generated client (no schema duplication). Each tool is a plain, independently-testable async function; `server.ts` is a thin MCP registration layer on top.

**Tech Stack:** TypeScript (ESM, `tsx` for running, `tsc --noEmit` for typechecking), `@modelcontextprotocol/sdk` ^1.26.0, `zod` ^4.4.3, `@prisma/client`/`@prisma/adapter-pg` ^7.8.0, `vitest` for tests (new to this repo).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-18-priority-engine-mcp-scaffold-design.md` — every task below implements a piece of it.
- No mocking the database. Tests run against the real dev Postgres via `DATABASE_URL` from the repo-root `.env` (already configured; migrations already applied). Postgres must be running before executing any task's tests.
- Money values crossing a tool boundary are returned as **strings** (from Prisma `Decimal`), never floats.
- Enum literals used in Zod schemas must exactly mirror `src/generated/prisma/enums.ts` — that file is the single source of truth for valid values.
- `CONFIDENCE_THRESHOLD` (in `classify-transaction.ts`) is a **provisional placeholder** (`0.8`), explicitly commented as pending the Sprint-0 spike referenced in `docs/analysis/pass-2-solution-definition.md` §7 — not a final business decision.
- `compute_allocation` and `get_projections` must throw a structured, descriptive error and never return a fabricated figure (backlog risk R-001).
- No file in this plan uses an import path extension (`.js`/`.ts`) on relative imports — this matches the existing repo convention (see `src/lib/auth.ts`, `src/lib/prisma.ts`).
- Every new source file lives under `packages/priority-engine-mcp/`; nothing in `src/` (the Next.js app) is modified except `package.json` (adding the `workspaces` field).

---

### Task 1: Workspace scaffolding & toolchain smoke test

**Files:**
- Modify: `package.json:1-30` (root — add `"workspaces"` field)
- Create: `packages/priority-engine-mcp/package.json`
- Create: `packages/priority-engine-mcp/tsconfig.json`
- Create: `packages/priority-engine-mcp/vitest.config.ts`
- Create: `packages/priority-engine-mcp/vitest.setup.ts`
- Create: `packages/priority-engine-mcp/src/smoke.ts`
- Test: `packages/priority-engine-mcp/src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `packages/priority-engine-mcp` as a resolvable npm workspace; `vitest.setup.ts` loads the repo-root `.env` into `process.env` before every test file runs — every later task's tests depend on this.

- [ ] **Step 1: Add the workspace field to the root `package.json`**

Edit `package.json`, adding `"workspaces"` right after `"private": true`:

```json
{
  "name": "cashflow-companion",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
```

- [ ] **Step 2: Create the new package's `package.json`**

```json
{
  "name": "@cashflow-companion/priority-engine-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^20",
    "dotenv": "^17.4.2",
    "tsx": "^4.19.0",
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: Create the package's `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```typescript
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
```

- [ ] **Step 6: Create a trivial smoke module**

```typescript
// packages/priority-engine-mcp/src/smoke.ts
export function ping(): string {
  return "pong";
}
```

- [ ] **Step 7: Write the failing smoke test**

```typescript
// packages/priority-engine-mcp/src/__tests__/smoke.test.ts
import { describe, expect, it } from "vitest";
import { ping } from "../smoke";

describe("toolchain smoke test", () => {
  it("resolves the workspace, loads .env, and runs a test", () => {
    expect(ping()).toBe("pong");
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
```

- [ ] **Step 8: Install dependencies from the repo root**

Run: `npm install`
Expected: installs succeed, `node_modules/.package-lock.json` and `package-lock.json` show the new workspace's dependencies; no errors.

- [ ] **Step 9: Run the smoke test**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp`
Expected: PASS — 1 test passed, confirming both the workspace resolves and `DATABASE_URL` is loaded from the root `.env`.

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck --workspace=@cashflow-companion/priority-engine-mcp`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json packages/priority-engine-mcp
git commit -m "$(cat <<'EOF'
Scaffold priority-engine-mcp workspace package

Adds the npm workspace, TypeScript/Vitest toolchain, and a smoke test
confirming the workspace resolves and loads DATABASE_URL from the
repo-root .env.
EOF
)"
```

---

### Task 2: Prisma singleton + connectivity test

**Files:**
- Create: `packages/priority-engine-mcp/src/db.ts`
- Test: `packages/priority-engine-mcp/src/__tests__/db.test.ts`

**Interfaces:**
- Consumes: `PrismaClient` from `../../../src/generated/prisma/client` (the Next.js app's generated output — not duplicated).
- Produces: `export const prisma: PrismaClient` — every subsequent tool file imports this singleton.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/priority-engine-mcp/src/__tests__/db.test.ts
import { describe, expect, it } from "vitest";
import { prisma } from "../db";

describe("prisma singleton", () => {
  it("connects to the database", async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- db.test`
Expected: FAIL — cannot find module `../db`.

- [ ] **Step 3: Write `db.ts`**

```typescript
// packages/priority-engine-mcp/src/db.ts
import { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export type { PrismaClient } from "../../../src/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  priorityEnginePrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.priorityEnginePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.priorityEnginePrisma = prisma;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- db.test`
Expected: PASS. If it fails with a connection error, confirm Postgres is running and `prisma/migrations` are applied at the repo root (`npm run prisma:migrate`).

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/db.ts packages/priority-engine-mcp/src/__tests__/db.test.ts
git commit -m "$(cat <<'EOF'
Add Prisma singleton for priority-engine-mcp

Reuses the Next.js app's generated Prisma client via a relative
import instead of duplicating the schema/generation step.
EOF
)"
```

---

### Task 3: Shared test fixtures

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/__tests__/helpers.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/helpers.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../../db`.
- Produces (used by every remaining test task):
  - `createTestUser(prisma): Promise<User>`
  - `createTestTransaction(prisma, userId): Promise<{ connection, account, transaction }>`
  - `createTestPlanFixture(prisma, userId): Promise<{ goalConfig, taxProfile, triggerEvent, agentRun, plan }>`
  - `deleteTestUser(prisma, userId): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/helpers.test.ts
import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { createTestUser, deleteTestUser } from "./helpers";

describe("test fixtures", () => {
  it("creates and fully deletes a test user", async () => {
    const user = await createTestUser(prisma);
    expect(user.id).toBeDefined();

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).not.toBeNull();

    await deleteTestUser(prisma, user.id);

    const goneCheck = await prisma.user.findUnique({ where: { id: user.id } });
    expect(goneCheck).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- helpers.test`
Expected: FAIL — cannot find module `./helpers`.

- [ ] **Step 3: Write `helpers.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/helpers.ts
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../db";

export async function createTestUser(prisma: PrismaClient) {
  return prisma.user.create({
    data: {
      clerkUserId: `test_${randomUUID()}`,
      email: `test-${randomUUID()}@example.com`,
      v1Eligibility: "schedule_c_supported",
    },
  });
}

export async function createTestTransaction(prisma: PrismaClient, userId: string) {
  const connection = await prisma.bankConnection.create({
    data: {
      userId,
      provider: "plaid",
      providerItemId: `test-item-${randomUUID()}`,
      status: "active",
      encryptedAccessToken: "test-encrypted",
      accessTokenIv: "test-iv",
      accessTokenAuthTag: "test-auth-tag",
    },
  });

  const account = await prisma.bankAccount.create({
    data: {
      connectionId: connection.id,
      providerAccountId: `test-account-${randomUUID()}`,
      type: "checking",
      isCommingled: false,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      accountId: account.id,
      providerTxnId: `test-txn-${randomUUID()}`,
      postedDate: new Date("2026-07-15"),
      amount: 5000,
      rawDescription: "Test deposit",
    },
  });

  return { connection, account, transaction };
}

export async function createTestPlanFixture(prisma: PrismaClient, userId: string) {
  const goalConfig = await prisma.goalConfig.create({
    data: {
      userId,
      versionNo: 1,
      isCurrent: true,
      effectiveFrom: new Date("2026-07-01"),
      bucketTargets: {
        create: [
          { bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 },
          { bucketKind: "runway", priorityOrder: 2, targetAmount: 6000, isFloor: true, floorAmount: 6000 },
          { bucketKind: "pay", priorityOrder: 3, targetAmount: 6000, isFloor: false, floorAmount: null },
        ],
      },
    },
  });

  const taxProfile = await prisma.taxProfile.create({
    data: {
      userId,
      versionNo: 1,
      isCurrent: true,
      taxYear: 2026,
      filingStatus: "single",
      taxTreatment: "schedule_c",
      residentTaxJurisdiction: "CA",
      effectiveFrom: new Date("2026-07-01"),
    },
  });

  const triggerEvent = await prisma.triggerEvent.create({
    data: {
      userId,
      triggerType: "manual_feedback",
      payload: {},
      idempotencyKey: `test-trigger-${randomUUID()}`,
    },
  });

  const agentRun = await prisma.agentRun.create({
    data: {
      userId,
      triggerEventId: triggerEvent.id,
      status: "ok",
    },
  });

  const plan = await prisma.plan.create({
    data: {
      userId,
      agentRunId: agentRun.id,
      goalConfigId: goalConfig.id,
      taxProfileId: taxProfile.id,
      runType: "synthesize",
      planStatus: "final",
      inputFreshnessStatus: "fresh",
      engineVersion: "0.1.0",
      engineBuildSha: "test-sha",
      safeToPayLow: 3650,
      safeToPayHigh: 5050,
      promisedNumber: 3650,
      taxBombStatus: "gap",
      appliedForecastParams: {},
      assumptions: {},
      inputDigest: "test-input-digest",
      inputDigestAlgo: "sha256",
      inputDigestSpecVersion: "v1",
      outputDigest: "test-output-digest",
      outputDigestAlgo: "sha256",
      outputDigestSpecVersion: "v1",
    },
  });

  return { goalConfig, taxProfile, triggerEvent, agentRun, plan };
}

export async function deleteTestUser(prisma: PrismaClient, userId: string) {
  await prisma.$transaction([
    prisma.recommendationOutcome.deleteMany({ where: { plan: { userId } } }),
    prisma.checkIn.deleteMany({ where: { plan: { userId } } }),
    prisma.planWarning.deleteMany({ where: { plan: { userId } } }),
    prisma.allocationLine.deleteMany({ where: { plan: { userId } } }),
    prisma.projection.deleteMany({ where: { plan: { userId } } }),
    prisma.plan.deleteMany({ where: { userId } }),
    prisma.agentRun.deleteMany({ where: { userId } }),
    prisma.triggerEvent.deleteMany({ where: { userId } }),
    prisma.transactionClassification.deleteMany({
      where: { transaction: { account: { connection: { userId } } } },
    }),
    prisma.transaction.deleteMany({
      where: { account: { connection: { userId } } },
    }),
    prisma.accountBalanceSnapshot.deleteMany({
      where: { account: { connection: { userId } } },
    }),
    prisma.bankAccount.deleteMany({ where: { connection: { userId } } }),
    prisma.bankConnection.deleteMany({ where: { userId } }),
    prisma.bucketTarget.deleteMany({ where: { goalConfig: { userId } } }),
    prisma.goalConfig.deleteMany({ where: { userId } }),
    prisma.taxProfile.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- helpers.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/__tests__/helpers.ts packages/priority-engine-mcp/src/tools/__tests__/helpers.test.ts
git commit -m "$(cat <<'EOF'
Add shared test fixtures for priority-engine-mcp tool tests

createTestUser/createTestTransaction/createTestPlanFixture build the
minimal valid row chains each tool test needs; deleteTestUser cleans
up in FK-safe order so tests never leave orphaned rows in the real
dev database.
EOF
)"
```

---

### Task 4: `get_state` tool

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/get-state.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/get-state.test.ts`

**Interfaces:**
- Consumes: `prisma` (from `../db`), `createTestUser`/`createTestPlanFixture`/`deleteTestUser` (from `./__tests__/helpers`, test only).
- Produces:
  - `export const getStateInputShape: { userId: ZodString }`
  - `export interface GetStateInput { userId: string }`
  - `export interface GetStateResult { goalConfig, taxProfile, balances, latestPlan }` (see body below)
  - `export async function getState(prisma: PrismaClient, input: GetStateInput): Promise<GetStateResult>`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/get-state.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { getState } from "../get-state";
import { createTestPlanFixture, createTestUser, deleteTestUser } from "./helpers";

describe("getState", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("returns null/empty sections for a user with no config or plan yet", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const result = await getState(prisma, { userId: user.id });

    expect(result).toEqual({
      goalConfig: null,
      taxProfile: null,
      balances: [],
      latestPlan: null,
    });
  });

  it("returns the current goal config, tax profile, and latest plan", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const fixture = await createTestPlanFixture(prisma, user.id);

    const result = await getState(prisma, { userId: user.id });

    expect(result.goalConfig).toMatchObject({
      id: fixture.goalConfig.id,
      versionNo: 1,
      bucketTargets: expect.arrayContaining([
        expect.objectContaining({ bucketKind: "taxes", targetAmount: "4800" }),
      ]),
    });
    expect(result.taxProfile).toMatchObject({
      id: fixture.taxProfile.id,
      filingStatus: "single",
      residentTaxJurisdiction: "CA",
    });
    expect(result.latestPlan).toMatchObject({
      id: fixture.plan.id,
      promisedNumber: "3650",
      taxBombStatus: "gap",
    });
  });

  it("ignores a superseded goal config version", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const v1 = await prisma.goalConfig.create({
      data: { userId: user.id, versionNo: 1, isCurrent: false, effectiveFrom: new Date("2026-01-01") },
    });
    const v2 = await prisma.goalConfig.create({
      data: { userId: user.id, versionNo: 2, isCurrent: true, effectiveFrom: new Date("2026-07-01") },
    });

    const result = await getState(prisma, { userId: user.id });

    expect(result.goalConfig?.id).toBe(v2.id);
    expect(result.goalConfig?.id).not.toBe(v1.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- get-state.test`
Expected: FAIL — cannot find module `../get-state`.

- [ ] **Step 3: Write `get-state.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/get-state.ts
import { z } from "zod";
import type { PrismaClient } from "../db";

export const getStateInputShape = {
  userId: z.string().uuid(),
};

export interface GetStateInput {
  userId: string;
}

export interface GetStateResult {
  goalConfig: {
    id: string;
    versionNo: number;
    effectiveFrom: string;
    bucketTargets: Array<{
      bucketKind: string;
      priorityOrder: number;
      targetAmount: string;
      isFloor: boolean;
      floorAmount: string | null;
    }>;
  } | null;
  taxProfile: {
    id: string;
    versionNo: number;
    taxYear: number;
    filingStatus: string;
    taxTreatment: string;
    residentTaxJurisdiction: string;
    effectiveFrom: string;
  } | null;
  balances: Array<{
    accountId: string;
    balance: string;
    asOf: string;
    source: string;
  }>;
  latestPlan: {
    id: string;
    planStatus: string;
    safeToPayLow: string;
    safeToPayHigh: string;
    promisedNumber: string;
    taxBombStatus: string;
    createdAt: string;
  } | null;
}

export async function getState(prisma: PrismaClient, input: GetStateInput): Promise<GetStateResult> {
  const [goalConfig, taxProfile, accounts, latestPlan] = await Promise.all([
    prisma.goalConfig.findFirst({
      where: { userId: input.userId, isCurrent: true },
      include: { bucketTargets: true },
    }),
    prisma.taxProfile.findFirst({
      where: { userId: input.userId, isCurrent: true },
    }),
    prisma.bankAccount.findMany({
      where: { connection: { userId: input.userId } },
      include: { balanceSnapshots: { orderBy: { asOf: "desc" }, take: 1 } },
    }),
    prisma.plan.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    goalConfig: goalConfig
      ? {
          id: goalConfig.id,
          versionNo: goalConfig.versionNo,
          effectiveFrom: goalConfig.effectiveFrom.toISOString(),
          bucketTargets: goalConfig.bucketTargets.map((b) => ({
            bucketKind: b.bucketKind,
            priorityOrder: b.priorityOrder,
            targetAmount: b.targetAmount.toString(),
            isFloor: b.isFloor,
            floorAmount: b.floorAmount?.toString() ?? null,
          })),
        }
      : null,
    taxProfile: taxProfile
      ? {
          id: taxProfile.id,
          versionNo: taxProfile.versionNo,
          taxYear: taxProfile.taxYear,
          filingStatus: taxProfile.filingStatus,
          taxTreatment: taxProfile.taxTreatment,
          residentTaxJurisdiction: taxProfile.residentTaxJurisdiction,
          effectiveFrom: taxProfile.effectiveFrom.toISOString(),
        }
      : null,
    balances: accounts
      .filter((a) => a.balanceSnapshots.length > 0)
      .map((a) => ({
        accountId: a.id,
        balance: a.balanceSnapshots[0].balance.toString(),
        asOf: a.balanceSnapshots[0].asOf.toISOString(),
        source: a.balanceSnapshots[0].source,
      })),
    latestPlan: latestPlan
      ? {
          id: latestPlan.id,
          planStatus: latestPlan.planStatus,
          safeToPayLow: latestPlan.safeToPayLow.toString(),
          safeToPayHigh: latestPlan.safeToPayHigh.toString(),
          promisedNumber: latestPlan.promisedNumber.toString(),
          taxBombStatus: latestPlan.taxBombStatus,
          createdAt: latestPlan.createdAt.toISOString(),
        }
      : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- get-state.test`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/get-state.ts packages/priority-engine-mcp/src/tools/__tests__/get-state.test.ts
git commit -m "$(cat <<'EOF'
Implement get_state tool

Reads current goal config + bucket targets, current tax profile,
latest balance snapshot per account, and the most recent plan. Missing
sections return null rather than erroring — a brand-new user is a
valid state.
EOF
)"
```

---

### Task 5: `set_goal` tool

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/set-goal.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/set-goal.test.ts`

**Interfaces:**
- Consumes: `prisma` (from `../db`).
- Produces:
  - `export const setGoalInputShape: { userId, effectiveFrom, bucketTargets }`
  - `export interface SetGoalInput { userId: string; effectiveFrom: string; bucketTargets: Array<{ bucketKind: string; priorityOrder: number; targetAmount: number; isFloor: boolean; floorAmount?: number }> }`
  - `export async function setGoal(prisma: PrismaClient, input: SetGoalInput): Promise<{ goalConfigId: string; versionNo: number }>`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/set-goal.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { setGoal } from "../set-goal";
import { createTestUser, deleteTestUser } from "./helpers";

describe("setGoal", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("creates the first goal config version when none exists", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const result = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      bucketTargets: [
        { bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 },
        { bucketKind: "pay", priorityOrder: 2, targetAmount: 6000, isFloor: false },
      ],
    });

    expect(result.versionNo).toBe(1);

    const stored = await prisma.goalConfig.findUnique({
      where: { id: result.goalConfigId },
      include: { bucketTargets: true },
    });
    expect(stored?.isCurrent).toBe(true);
    expect(stored?.bucketTargets).toHaveLength(2);
  });

  it("supersedes the prior current version when called again", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const first = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      bucketTargets: [{ bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 }],
    });

    const second = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-08-01T00:00:00.000Z",
      bucketTargets: [{ bucketKind: "taxes", priorityOrder: 1, targetAmount: 5000, isFloor: true, floorAmount: 5000 }],
    });

    expect(second.versionNo).toBe(2);

    const priorRow = await prisma.goalConfig.findUnique({ where: { id: first.goalConfigId } });
    expect(priorRow?.isCurrent).toBe(false);

    const currentRow = await prisma.goalConfig.findFirst({ where: { userId: user.id, isCurrent: true } });
    expect(currentRow?.id).toBe(second.goalConfigId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- set-goal.test`
Expected: FAIL — cannot find module `../set-goal`.

- [ ] **Step 3: Write `set-goal.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/set-goal.ts
import { z } from "zod";
import type { PrismaClient } from "../db";

const bucketKinds = ["taxes", "runway", "pay", "savings", "debt"] as const;

export const setGoalInputShape = {
  userId: z.string().uuid(),
  effectiveFrom: z.string().datetime(),
  bucketTargets: z
    .array(
      z.object({
        bucketKind: z.enum(bucketKinds),
        priorityOrder: z.number().int().nonnegative(),
        targetAmount: z.number().nonnegative(),
        isFloor: z.boolean(),
        floorAmount: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
};

export interface SetGoalInput {
  userId: string;
  effectiveFrom: string;
  bucketTargets: Array<{
    bucketKind: (typeof bucketKinds)[number];
    priorityOrder: number;
    targetAmount: number;
    isFloor: boolean;
    floorAmount?: number;
  }>;
}

export async function setGoal(
  prisma: PrismaClient,
  input: SetGoalInput,
): Promise<{ goalConfigId: string; versionNo: number }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.goalConfig.findFirst({
      where: { userId: input.userId, isCurrent: true },
    });

    if (prior) {
      await tx.goalConfig.update({
        where: { id: prior.id },
        data: { isCurrent: false },
      });
    }

    const versionNo = (prior?.versionNo ?? 0) + 1;

    const created = await tx.goalConfig.create({
      data: {
        userId: input.userId,
        versionNo,
        isCurrent: true,
        effectiveFrom: new Date(input.effectiveFrom),
        bucketTargets: {
          create: input.bucketTargets.map((b) => ({
            bucketKind: b.bucketKind,
            priorityOrder: b.priorityOrder,
            targetAmount: b.targetAmount,
            isFloor: b.isFloor,
            floorAmount: b.floorAmount ?? null,
          })),
        },
      },
    });

    return { goalConfigId: created.id, versionNo: created.versionNo };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- set-goal.test`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/set-goal.ts packages/priority-engine-mcp/src/tools/__tests__/set-goal.test.ts
git commit -m "$(cat <<'EOF'
Implement set_goal tool

Writes a new versioned GoalConfig + BucketTarget rows, flipping the
prior current version's isCurrent flag inside the same transaction so
the goal_config_one_current_per_user partial-unique index is never
violated.
EOF
)"
```

---

### Task 6: `classify_transaction` tool

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/classify-transaction.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/classify-transaction.test.ts`

**Interfaces:**
- Consumes: `prisma` (from `../db`), `createTestUser`/`createTestTransaction`/`deleteTestUser` (test only).
- Produces:
  - `export const CONFIDENCE_THRESHOLD = 0.8`
  - `export const classifyTransactionInputShape`
  - `export interface ClassifyTransactionInput { transactionId; label; cadence?; confidence?; evidence? }`
  - `export async function classifyTransaction(prisma, input): Promise<{ classificationId: string; reviewState: string }>`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/classify-transaction.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { classifyTransaction } from "../classify-transaction";
import { createTestTransaction, createTestUser, deleteTestUser } from "./helpers";

describe("classifyTransaction", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("marks reviewState confirmed when confidence meets the threshold", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.95,
    });

    expect(result.reviewState).toBe("confirmed");
  });

  it("marks reviewState pending when confidence is below the threshold", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.4,
    });

    expect(result.reviewState).toBe("pending");
  });

  it("marks reviewState pending when no confidence is provided", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
    });

    expect(result.reviewState).toBe("pending");
  });

  it("supersedes a prior current classification for the same transaction", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const first = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.9,
    });

    const second = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.9,
    });

    const priorRow = await prisma.transactionClassification.findUnique({ where: { id: first.classificationId } });
    expect(priorRow?.isCurrent).toBe(false);

    const currentRow = await prisma.transactionClassification.findFirst({
      where: { transactionId: transaction.id, isCurrent: true },
    });
    expect(currentRow?.id).toBe(second.classificationId);
    expect(currentRow?.supersedesId).toBe(first.classificationId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- classify-transaction.test`
Expected: FAIL — cannot find module `../classify-transaction`.

- [ ] **Step 3: Write `classify-transaction.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/classify-transaction.ts
import { z } from "zod";
import type { PrismaClient } from "../db";

const classificationLabels = [
  "income",
  "transfer",
  "refund",
  "repayment",
  "loan",
  "other",
  "fixed_recurring",
  "variable_discretionary",
] as const;

const classificationCadences = ["retainer", "project", "windfall"] as const;

// Provisional — the real value is an open decision pending the Sprint-0 spike.
// See docs/analysis/pass-2-solution-definition.md §7 and
// docs/analysis/pass-4-implementation-review.md §8.
export const CONFIDENCE_THRESHOLD = 0.8;

export const classifyTransactionInputShape = {
  transactionId: z.string().uuid(),
  label: z.enum(classificationLabels),
  cadence: z.enum(classificationCadences).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.unknown().optional(),
};

export interface ClassifyTransactionInput {
  transactionId: string;
  label: (typeof classificationLabels)[number];
  cadence?: (typeof classificationCadences)[number];
  confidence?: number;
  evidence?: unknown;
}

export async function classifyTransaction(
  prisma: PrismaClient,
  input: ClassifyTransactionInput,
): Promise<{ classificationId: string; reviewState: string }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.transactionClassification.findFirst({
      where: { transactionId: input.transactionId, isCurrent: true },
    });

    if (prior) {
      await tx.transactionClassification.update({
        where: { id: prior.id },
        data: { isCurrent: false },
      });
    }

    // Bias to ask (BRULE-005): confirmed only when confidence explicitly
    // meets the threshold. Missing or low confidence always falls back to
    // pending — never silently confirmed.
    const reviewState =
      input.confidence !== undefined && input.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "pending";

    const created = await tx.transactionClassification.create({
      data: {
        transactionId: input.transactionId,
        source: "model",
        label: input.label,
        cadence: input.cadence,
        confidence: input.confidence,
        evidence: input.evidence === undefined ? undefined : (input.evidence as object),
        reviewState,
        supersedesId: prior?.id,
        isCurrent: true,
      },
    });

    return { classificationId: created.id, reviewState: created.reviewState };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- classify-transaction.test`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/classify-transaction.ts packages/priority-engine-mcp/src/tools/__tests__/classify-transaction.test.ts
git commit -m "$(cat <<'EOF'
Implement classify_transaction tool

Writes a model-sourced TransactionClassification, superseding any
prior current row. Enforces the bias-to-ask rule (BRULE-005)
structurally: confirmed only when confidence explicitly meets
CONFIDENCE_THRESHOLD, a provisional constant pending the Sprint-0
confidence-threshold spike.
EOF
)"
```

---

### Task 7: `record_correction` tool

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/record-correction.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/record-correction.test.ts`

**Interfaces:**
- Consumes: `prisma` (from `../db`), `classifyTransaction` (from `./classify-transaction`, test only, to seed a classification to correct), `createTestUser`/`createTestTransaction`/`deleteTestUser` (test only).
- Produces:
  - `export const recordCorrectionInputShape`
  - `export interface RecordCorrectionInput { classificationId; label; cadence?; checkInId? }`
  - `export async function recordCorrection(prisma, input): Promise<{ classificationId: string }>`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/record-correction.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { classifyTransaction } from "../classify-transaction";
import { recordCorrection } from "../record-correction";
import { createTestPlanFixture, createTestTransaction, createTestUser, deleteTestUser } from "./helpers";

describe("recordCorrection", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("creates a corrected classification and supersedes the prior one", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const corrected = await recordCorrection(prisma, {
      classificationId: original.classificationId,
      label: "income",
    });

    const priorRow = await prisma.transactionClassification.findUnique({
      where: { id: original.classificationId },
    });
    expect(priorRow?.isCurrent).toBe(false);

    const newRow = await prisma.transactionClassification.findUnique({
      where: { id: corrected.classificationId },
    });
    expect(newRow?.source).toBe("user");
    expect(newRow?.reviewState).toBe("corrected");
    expect(newRow?.supersedesId).toBe(original.classificationId);
    expect(newRow?.label).toBe("income");
  });

  it("links a CheckIn's resultingClassificationId when checkInId is provided", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const fixture = await createTestPlanFixture(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const checkIn = await prisma.checkIn.create({
      data: {
        planId: fixture.plan.id,
        agentRunId: fixture.agentRun.id,
        decisionText: "Is this Acme payment income?",
        channel: "ui",
      },
    });

    const corrected = await recordCorrection(prisma, {
      classificationId: original.classificationId,
      label: "income",
      checkInId: checkIn.id,
    });

    const updatedCheckIn = await prisma.checkIn.findUnique({ where: { id: checkIn.id } });
    expect(updatedCheckIn?.resultingClassificationId).toBe(corrected.classificationId);
  });

  it("prevents two concurrent corrections from both becoming current", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const results = await Promise.allSettled([
      recordCorrection(prisma, { classificationId: original.classificationId, label: "income" }),
      recordCorrection(prisma, { classificationId: original.classificationId, label: "transfer" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const currentRows = await prisma.transactionClassification.findMany({
      where: { transactionId: transaction.id, isCurrent: true },
    });
    expect(currentRows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- record-correction.test`
Expected: FAIL — cannot find module `../record-correction`.

- [ ] **Step 3: Write `record-correction.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/record-correction.ts
import { z } from "zod";
import type { PrismaClient } from "../db";

const classificationLabels = [
  "income",
  "transfer",
  "refund",
  "repayment",
  "loan",
  "other",
  "fixed_recurring",
  "variable_discretionary",
] as const;

const classificationCadences = ["retainer", "project", "windfall"] as const;

export const recordCorrectionInputShape = {
  classificationId: z.string().uuid(),
  label: z.enum(classificationLabels),
  cadence: z.enum(classificationCadences).optional(),
  checkInId: z.string().uuid().optional(),
};

export interface RecordCorrectionInput {
  classificationId: string;
  label: (typeof classificationLabels)[number];
  cadence?: (typeof classificationCadences)[number];
  checkInId?: string;
}

export async function recordCorrection(
  prisma: PrismaClient,
  input: RecordCorrectionInput,
): Promise<{ classificationId: string }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.transactionClassification.findUniqueOrThrow({
      where: { id: input.classificationId },
    });

    await tx.transactionClassification.update({
      where: { id: prior.id },
      data: { isCurrent: false },
    });

    const created = await tx.transactionClassification.create({
      data: {
        transactionId: prior.transactionId,
        source: "user",
        label: input.label,
        cadence: input.cadence,
        reviewState: "corrected",
        supersedesId: prior.id,
        isCurrent: true,
      },
    });

    if (input.checkInId) {
      await tx.checkIn.update({
        where: { id: input.checkInId },
        data: { resultingClassificationId: created.id },
      });
    }

    return { classificationId: created.id };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- record-correction.test`
Expected: PASS — 3 tests passed. The concurrency test relies on the existing `classification_one_current_per_txn` and `transaction_classification_supersedes_id_key` unique indexes (already in `prisma/migrations/20260718042721_init/migration.sql`) to reject the second concurrent write — no new migration needed.

- [ ] **Step 5: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/record-correction.ts packages/priority-engine-mcp/src/tools/__tests__/record-correction.test.ts
git commit -m "$(cat <<'EOF'
Implement record_correction tool

Atomic user-correction write: new TransactionClassification(source:
user), prior row's isCurrent flipped, CheckIn.resultingClassificationId
linked when provided — all in one transaction. Relies on the existing
partial-unique isCurrent index to reject a concurrent second
correction rather than allowing two current rows.
EOF
)"
```

---

### Task 8: `compute_allocation` and `get_projections` stubs

**Files:**
- Create: `packages/priority-engine-mcp/src/tools/compute-allocation.ts`
- Create: `packages/priority-engine-mcp/src/tools/get-projections.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/compute-allocation.test.ts`
- Test: `packages/priority-engine-mcp/src/tools/__tests__/get-projections.test.ts`

**Interfaces:**
- Produces:
  - `export const computeAllocationInputShape`, `export interface ComputeAllocationInput { userId; agentRunId; triggerContext? }`, `export async function computeAllocation(prisma, input): Promise<never>` (always throws)
  - `export const getProjectionsInputShape`, `export interface GetProjectionsInput { userId; planId? }`, `export async function getProjections(prisma, input): Promise<never>` (always throws)

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/compute-allocation.test.ts
import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { computeAllocation } from "../compute-allocation";

describe("computeAllocation", () => {
  it("throws a not-implemented error rather than fabricating a number", async () => {
    await expect(
      computeAllocation(prisma, {
        userId: "00000000-0000-0000-0000-000000000000",
        agentRunId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/not yet implemented.*EPIC-11/s);
  });
});
```

```typescript
// packages/priority-engine-mcp/src/tools/__tests__/get-projections.test.ts
import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { getProjections } from "../get-projections";

describe("getProjections", () => {
  it("throws a not-implemented error rather than returning fabricated projections", async () => {
    await expect(
      getProjections(prisma, { userId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(/not yet implemented.*EPIC-12/s);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- compute-allocation.test get-projections.test`
Expected: FAIL — cannot find modules `../compute-allocation` and `../get-projections`.

- [ ] **Step 3: Write `compute-allocation.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/compute-allocation.ts
import { z } from "zod";
import type { PrismaClient } from "../db";

export const computeAllocationInputShape = {
  userId: z.string().uuid(),
  agentRunId: z.string().uuid(),
  triggerContext: z.unknown().optional(),
};

export interface ComputeAllocationInput {
  userId: string;
  agentRunId: string;
  triggerContext?: unknown;
}

export class NotImplementedError extends Error {}

/**
 * Stub. The waterfall this tool wraps (EPIC-11: Allocation Waterfall &
 * Safety Floors, ST-031/032/033/034) does not exist yet. Per R-001 in the
 * backlog's risk register, a wrong Safe-to-Pay number is the single most
 * damaging possible defect — so this throws rather than returning any
 * number, fabricated or otherwise.
 */
export async function computeAllocation(
  _prisma: PrismaClient,
  _input: ComputeAllocationInput,
): Promise<never> {
  throw new NotImplementedError(
    "compute_allocation is not yet implemented — depends on EPIC-11 (Allocation Waterfall & " +
      "Safety Floors, ST-031/032/033/034). See " +
      "docs/superpowers/specs/2026-07-18-priority-engine-mcp-scaffold-design.md.",
  );
}
```

- [ ] **Step 4: Write `get-projections.ts`**

```typescript
// packages/priority-engine-mcp/src/tools/get-projections.ts
import { z } from "zod";
import type { PrismaClient } from "../db";
import { NotImplementedError } from "./compute-allocation";

export const getProjectionsInputShape = {
  userId: z.string().uuid(),
  planId: z.string().uuid().optional(),
};

export interface GetProjectionsInput {
  userId: string;
  planId?: string;
}

/**
 * Stub. The forecasting this tool wraps (EPIC-12: Income & Spend
 * Forecasting, ST-036) does not exist yet — see compute-allocation.ts for
 * why this throws instead of returning placeholder projections.
 */
export async function getProjections(
  _prisma: PrismaClient,
  _input: GetProjectionsInput,
): Promise<never> {
  throw new NotImplementedError(
    "get_projections is not yet implemented — depends on EPIC-12 (Income & Spend Forecasting, " +
      "ST-036). See docs/superpowers/specs/2026-07-18-priority-engine-mcp-scaffold-design.md.",
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- compute-allocation.test get-projections.test`
Expected: PASS — 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/priority-engine-mcp/src/tools/compute-allocation.ts packages/priority-engine-mcp/src/tools/get-projections.ts packages/priority-engine-mcp/src/tools/__tests__/compute-allocation.test.ts packages/priority-engine-mcp/src/tools/__tests__/get-projections.test.ts
git commit -m "$(cat <<'EOF'
Add compute_allocation and get_projections stubs

Both throw a descriptive NotImplementedError naming the epic/stories
they depend on (EPIC-11, EPIC-12) rather than fabricating a number or
projection range — a wrong Safe-to-Pay figure is the highest-
consequence defect this system can produce (backlog risk R-001).
EOF
)"
```

---

### Task 9: MCP server wiring (stdio entrypoint)

**Files:**
- Create: `packages/priority-engine-mcp/src/server.ts`
- Create: `packages/priority-engine-mcp/src/index.ts`
- Test: `packages/priority-engine-mcp/src/__tests__/server.test.ts`

**Interfaces:**
- Consumes: all 6 tool modules from `./tools/*` (both their `*InputShape` and handler functions), `prisma` from `./db`.
- Produces: `export function createServer(): McpServer` — the full, registered server, connectable to any `Transport` (stdio in production, `InMemoryTransport` in tests).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/priority-engine-mcp/src/__tests__/server.test.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { createServer } from "../server";
import { createTestUser, deleteTestUser } from "../tools/__tests__/helpers";

async function connectedClient(server: ReturnType<typeof createServer>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("priority engine MCP server wiring", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("lists all 6 registered tools", async () => {
    const client = await connectedClient(createServer());

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      "classify_transaction",
      "compute_allocation",
      "get_projections",
      "get_state",
      "record_correction",
      "set_goal",
    ]);

    await client.close();
  });

  it("calls get_state through the protocol for a fresh user", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const client = await connectedClient(createServer());

    const result = await client.callTool({ name: "get_state", arguments: { userId: user.id } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      goalConfig: null,
      taxProfile: null,
      balances: [],
      latestPlan: null,
    });

    await client.close();
  });

  it("returns isError for compute_allocation (not yet implemented)", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const client = await connectedClient(createServer());

    const result = await client.callTool({
      name: "compute_allocation",
      arguments: { userId: user.id, agentRunId: "00000000-0000-0000-0000-000000000000" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("EPIC-11") })]),
    );

    await client.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- server.test`
Expected: FAIL — cannot find module `../server`.

- [ ] **Step 3: Write `server.ts`**

```typescript
// packages/priority-engine-mcp/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "./db";
import { classifyTransaction, classifyTransactionInputShape } from "./tools/classify-transaction";
import { computeAllocation, computeAllocationInputShape } from "./tools/compute-allocation";
import { getProjections, getProjectionsInputShape } from "./tools/get-projections";
import { getState, getStateInputShape } from "./tools/get-state";
import { recordCorrection, recordCorrectionInputShape } from "./tools/record-correction";
import { setGoal, setGoalInputShape } from "./tools/set-goal";

async function toToolResult(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await work();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "priority-engine-mcp", version: "0.1.0" });

  server.registerTool(
    "get_state",
    {
      description: "Read the current goal config, tax profile, balances, and latest plan for a user.",
      inputSchema: getStateInputShape,
    },
    (input) => toToolResult(() => getState(prisma, input)),
  );

  server.registerTool(
    "set_goal",
    {
      description: "Write a new versioned goal config, superseding the prior current version.",
      inputSchema: setGoalInputShape,
    },
    (input) => toToolResult(() => setGoal(prisma, input)),
  );

  server.registerTool(
    "classify_transaction",
    {
      description: "Record a model-proposed transaction classification.",
      inputSchema: classifyTransactionInputShape,
    },
    (input) => toToolResult(() => classifyTransaction(prisma, input)),
  );

  server.registerTool(
    "record_correction",
    {
      description: "Record a user correction to a transaction classification.",
      inputSchema: recordCorrectionInputShape,
    },
    (input) => toToolResult(() => recordCorrection(prisma, input)),
  );

  server.registerTool(
    "compute_allocation",
    {
      description: "Compute the priority waterfall allocation for a user. Not yet implemented.",
      inputSchema: computeAllocationInputShape,
    },
    (input) => toToolResult(() => computeAllocation(prisma, input)),
  );

  server.registerTool(
    "get_projections",
    {
      description: "Read income/runway/spend projections for a plan. Not yet implemented.",
      inputSchema: getProjectionsInputShape,
    },
    (input) => toToolResult(() => getProjections(prisma, input)),
  );

  return server;
}
```

- [ ] **Step 4: Write `index.ts`**

```typescript
// packages/priority-engine-mcp/src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp -- server.test`
Expected: PASS — 3 tests passed.

- [ ] **Step 6: Run the full test suite**

Run: `npm test --workspace=@cashflow-companion/priority-engine-mcp`
Expected: PASS — all tests across all 9 tasks pass (smoke, db, helpers, get-state ×3, set-goal ×2, classify-transaction ×4, record-correction ×3, compute-allocation, get-projections, server ×3 — 20 tests total).

- [ ] **Step 7: Typecheck the whole package**

Run: `npm run typecheck --workspace=@cashflow-companion/priority-engine-mcp`
Expected: no errors.

- [ ] **Step 8: Manually verify the stdio entrypoint starts**

Run: `npm run start --workspace=@cashflow-companion/priority-engine-mcp &`
Then send a single JSON-RPC `initialize` request on stdin (or use `npx @modelcontextprotocol/inspector node --loader tsx packages/priority-engine-mcp/src/index.ts` for an interactive check) and confirm the process responds instead of crashing. Stop the process afterward.
Expected: the server starts without throwing and responds to `initialize`.

- [ ] **Step 9: Commit**

```bash
git add packages/priority-engine-mcp/src/server.ts packages/priority-engine-mcp/src/index.ts packages/priority-engine-mcp/src/__tests__/server.test.ts
git commit -m "$(cat <<'EOF'
Wire the 6 tools into an McpServer with a stdio entrypoint

createServer() registers all 6 tools (4 real, 2 stubs) behind a
shared error-to-isError wrapper. index.ts connects it to
StdioServerTransport, matching the local-child-process transport
decision in the design spec. Wiring is tested end-to-end through the
real MCP protocol via InMemoryTransport, not by calling the tool
functions directly.
EOF
)"
```

---

## Plan Self-Review Notes

- **Spec coverage:** package layout (Task 1), Prisma sharing (Task 2), all 6 tool contracts (Tasks 4–8), testing approach incl. the concurrent-correction race (Task 7) and the not-implemented stub behavior (Task 8), transport (Task 9). The spec's "out of scope" items (real waterfall/forecasting, auth/HTTP, digest computation, resolving the confidence-threshold open decision) are correctly left untouched by every task above.
- **Type consistency:** `PrismaClient` type is imported the same way (`from "../db"` / `from "../../db"`) in every tool and test file; tool input interfaces (`GetStateInput`, `SetGoalInput`, `ClassifyTransactionInput`, `RecordCorrectionInput`, `ComputeAllocationInput`, `GetProjectionsInput`) are defined once each and reused verbatim in `server.ts`'s registration calls.
- **No placeholders:** the one intentionally-provisional value (`CONFIDENCE_THRESHOLD`) is real, working code with an explicit comment — not a TBD.
