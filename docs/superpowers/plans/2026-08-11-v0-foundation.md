# v0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the structural foundation of Headroom in place — a working test runner, the three missing workspace packages (`tokens`, `contracts`, `graph`), Prisma confined behind `packages/graph`, all HTTP routes under `/api/v1`, and the last of the cashflow product removed — so every later v0 plan (life graph, connectors, extraction, eval) builds on the port rules instead of retrofitting them.

**Architecture:** One Next.js deployment, with the client↔server contract separated by rule rather than by infrastructure (design doc §11). Business logic moves out of `src/` into workspace packages consumed as TypeScript source via `transpilePackages`; the web app keeps only route handlers and UI. Three of the seven port rules become *executable* architecture tests under `tests/architecture/` — rule 1 (all routes under `/api/v1`), rule 6 (Prisma imported only inside `packages/graph`), and a teardown gate (no cashflow vocabulary outside `docs/` and `prototype/`) — so a future task cannot silently regress them.

**Tech Stack:** Next.js 16.2.10 (App Router, standalone output), React 19.2.4, TypeScript 5, Prisma 7.8 with `@prisma/adapter-pg`, Clerk 7.6, Zod 4, Vitest 3, npm workspaces, Docker + GitHub Actions to Azure Container Apps.

## Global Constraints

- **Design doc is authoritative:** `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`. This plan implements §11 (architecture, the seven port rules) and §12 (teardown). Where this plan and the design doc conflict, the design doc wins.
- **Core rule 1 (§3):** the engine computes, the model extracts and phrases. Nothing in this plan may put a figure, date, duration, count, or score in a model-authored path.
- **Port rule 1:** `/api/v1/*` route handlers only, versioned from the first commit. No server actions for anything a future native client would need (port rule 2).
- **Port rule 3:** `packages/contracts` is the single source of truth for request/response shapes. Zod must run unchanged in React Native — no Node-only imports in that package.
- **Port rule 4:** design tokens are plain JS objects (numbers, not `"16px"` strings, for anything React Native's `StyleSheet` consumes). CSS variables are *generated from* the objects, never hand-maintained alongside them.
- **Port rule 6:** Prisma is imported only inside `packages/graph`. Enforced by `tests/architecture/prisma-boundary.test.ts`.
- **Port rule 7:** the engine stays MCP (`packages/engine-mcp`). This plan does not add engine tools — that is the v0 engine plan.
- **Port rule 5 is deliberately out of scope.** `NotificationChannel`, `VoiceSession`, and `SecureStore` are interfaces over capabilities that do not exist yet (web push lands in v0.5, voice in v1). Writing them now would be inventing an abstraction with one imaginary implementation. They are the first task of the v0.5 plan.
- **Node 22** in the deploy image (`node:22-alpine`); local dev is Node 25. Do not use APIs newer than Node 22.
- **Workspace packages are consumed as TypeScript source** (`"exports": { ".": "./src/index.ts" }`) plus `transpilePackages` in `next.config.ts`. No build step per package.
- **No new runtime dependencies** beyond `zod`. New devDependencies allowed: `vitest`, `tsx`.
- **Never reintroduce cashflow vocabulary** in `src/`, `packages/`, `prisma/`, or `README.md`: "cashflow", "Safe-to-Pay", "Schedule C", "Plaid", "tax-bomb", "runway floor". `docs/` and `prototype/` are exempt (they are historical/design artifacts).
- **The deploy must keep working.** `npm run build` and `docker build` are verification steps, not optional.
- **Postgres must be running** for `packages/graph` and `packages/engine-mcp` tests: `docker compose up -d`.

---

## File Structure

**New packages** (each is TS source, no build output):

| Path | Responsibility |
|---|---|
| `packages/tokens/src/tokens.ts` | Design tokens as plain JS objects — `color`, `radius`, `space`. Platform-agnostic. |
| `packages/tokens/src/css.ts` | Pure functions turning those objects into a `:root { --hr-* }` CSS string. |
| `packages/tokens/src/index.ts` | Re-export surface. |
| `packages/contracts/src/api.ts` | Zod schemas + inferred types for every `/api/v1` response. |
| `packages/contracts/src/index.ts` | Re-export surface. |
| `packages/graph/src/client.ts` | The Prisma singleton. The **only** file in the repo that imports `@prisma/client`. |
| `packages/graph/src/users.ts` | User queries — `findUserByClerkId`, `createUser`, `listUsers`, `pingDatabase`. |
| `packages/graph/src/index.ts` | Re-export surface. Everything outside this package imports from here. |
| `packages/graph/src/generated/prisma/` | Generated Prisma client (gitignored). Moved from `src/generated/prisma`. |

**New tests:**

| Path | Responsibility |
|---|---|
| `tests/architecture/tokens-css.test.ts` | `src/app/tokens.css` on disk matches the generator output (drift guard). |
| `tests/architecture/prisma-boundary.test.ts` | Port rule 6. |
| `tests/architecture/api-versioning.test.ts` | Port rule 1. |
| `tests/architecture/teardown.test.ts` | No cashflow vocabulary outside `docs/` and `prototype/`. |

**Moved:** `src/app/api/{health,me,users}/route.ts` → `src/app/api/v1/{health,me,users}/route.ts`.

**Deleted:** `src/lib/prisma.ts` (absorbed by `packages/graph`), `packages/engine-mcp/src/db.ts` (same), `cashflow-companion (5).html`.

**Rewritten:** all of `src/components/landing/*` copy, `src/app/layout.tsx` metadata, `README.md`.

**Deliberately NOT moved:** `prisma/schema.prisma` stays at the repo root. Only the generator's `output` path moves into `packages/graph`. Rationale: `prisma.config.ts` and the `Dockerfile` both reference `prisma/` at the root, and `migrate deploy` runs from the image root at container start. Moving the schema buys tidiness and risks the deploy; port rule 6 is about *imports*, and the architecture test enforces it either way.

---

## Task 1: Root test runner

There is no test runner for the web app — only `packages/engine-mcp` has Vitest. Every task after this one is TDD, so this comes first. The first real test covers `src/lib/token-encryption.ts`, which §12 keeps precisely because GitHub and Google refresh tokens will be stored with it.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/token-encryption.test.ts`
- Modify: `package.json` (add `vitest` devDependency, `test` + `test:watch` scripts)
- Modify: `packages/engine-mcp/vitest.config.ts` (add a project name)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` at the repo root runs every project's tests. Root-level tests live in `src/**/__tests__/*.test.ts` and `tests/**/*.test.ts`. The `@/*` alias resolves in tests exactly as it does in Next.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/token-encryption.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/token-encryption";

const VALID_KEY = "a".repeat(64); // 32 bytes as hex

describe("token encryption", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = previousKey;
  });

  it("round-trips a token", () => {
    const { encrypted, iv, authTag } = encryptToken("ghp_example_token");

    expect(encrypted).not.toContain("ghp_example_token");
    expect(decryptToken(encrypted, iv, authTag)).toBe("ghp_example_token");
  });

  it("uses a fresh iv per call, so identical plaintexts encrypt differently", () => {
    const first = encryptToken("same-token");
    const second = encryptToken("same-token");

    expect(first.iv).not.toBe(second.iv);
    expect(first.encrypted).not.toBe(second.encrypted);
  });

  it("rejects a tampered ciphertext", () => {
    const { encrypted, iv, authTag } = encryptToken("secret");
    const bytes = Buffer.from(encrypted, "base64");
    bytes[0] ^= 0xff;

    expect(() => decryptToken(bytes.toString("base64"), iv, authTag)).toThrow();
  });

  it("refuses a key that is not 32 bytes", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abcd";

    expect(() => encryptToken("anything")).toThrow(/32 bytes/);
  });

  it("refuses a missing key", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => encryptToken("anything")).toThrow(/not set/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"`. (No runner exists yet; that is the failure being fixed.)

- [ ] **Step 3: Install Vitest**

```bash
npm install -D vitest@^3.2.0
```

- [ ] **Step 4: Add the root Vitest config**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts", "tests/**/*.test.ts"],
        },
      },
      "packages/*/vitest.config.ts",
    ],
  },
});
```

- [ ] **Step 5: Add the test scripts**

In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 6: Name the engine-mcp project**

Replace `packages/engine-mcp/vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "engine-mcp",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `docker compose up -d` (the engine-mcp project has a test that needs Postgres), then `npm test`
Expected: PASS — two projects reported, `app` with 5 passing tests and `engine-mcp` with 3.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/__tests__/token-encryption.test.ts packages/engine-mcp/vitest.config.ts
git commit -m "test: add root Vitest runner and token-encryption tests"
```

---

## Task 2: packages/tokens

Port rule 4: design tokens as JS objects, not only CSS variables, so React Native's `StyleSheet` consumes the same file and the visual port is not a redesign. Values come from `prototype/headroom.html`'s `:root` — that prototype is the design system for every v0.5+ screen.

The generated CSS variables are prefixed `--hr-` so they coexist with the landing page's existing (differently-valued) `--ink`, `--green`, `--amber` in `src/app/globals.css`. The landing page is not being restyled here.

**Files:**
- Create: `packages/tokens/package.json`
- Create: `packages/tokens/tsconfig.json`
- Create: `packages/tokens/vitest.config.ts`
- Create: `packages/tokens/src/tokens.ts`
- Create: `packages/tokens/src/css.ts`
- Create: `packages/tokens/src/index.ts`
- Create: `packages/tokens/src/__tests__/css.test.ts`
- Create: `scripts/generate-tokens-css.ts`
- Create: `tests/architecture/tokens-css.test.ts`
- Create: `src/app/tokens.css` (generated)
- Modify: `src/app/globals.css` (import the generated file)
- Modify: `package.json` (add `tsx` devDependency, `tokens:css` script)

**Interfaces:**
- Consumes: the root Vitest runner from Task 1 (the `packages/*/vitest.config.ts` project glob).
- Produces:
  - `@headroom/tokens` exporting `color`, `radius`, `space` (radius and space are **numbers**, in px units).
  - `@headroom/tokens/css` is *not* a separate entrypoint — `cssVariables(): string` and `tokensCss(): string` are exported from the package root.
  - `src/app/tokens.css` defining `--hr-<kebab-name>` for every token.

- [ ] **Step 1: Write the failing test**

Create `packages/tokens/src/__tests__/css.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { color, cssVariables, radius, space, tokensCss } from "../index";

describe("token objects", () => {
  it("exposes spacing and radius as numbers so React Native can consume them", () => {
    expect(typeof radius.lg).toBe("number");
    expect(typeof space[4]).toBe("number");
  });

  it("exposes colors as hex strings", () => {
    expect(color.violet).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("cssVariables", () => {
  it("emits every color token as an --hr- prefixed variable", () => {
    const css = cssVariables();

    for (const value of Object.values(color)) {
      expect(css).toContain(value);
    }
    expect(css).toContain("--hr-violet: #5B4FE9;");
    expect(css).toContain("--hr-violet-bg: #F2F0FE;");
    expect(css).toContain("--hr-ink-2: #6B6F7E;");
  });

  it("emits numeric tokens with a px unit", () => {
    const css = cssVariables();

    expect(css).toContain("--hr-radius-lg: 16px;");
    expect(css).toContain("--hr-space-4: 16px;");
  });

  it("wraps the declarations in a :root block", () => {
    const css = cssVariables();

    expect(css.startsWith(":root {\n")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
  });
});

describe("tokensCss", () => {
  it("prefixes the generated file with a do-not-edit header", () => {
    expect(tokensCss()).toContain("npm run tokens:css");
    expect(tokensCss()).toContain(":root {");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --project tokens`
Expected: FAIL — no project named `tokens` exists yet ("No test files found").

- [ ] **Step 3: Create the package skeleton**

Create `packages/tokens/package.json`:

```json
{
  "name": "@headroom/tokens",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

Create `packages/tokens/tsconfig.json`:

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

Create `packages/tokens/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "tokens",
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the token objects**

Create `packages/tokens/src/tokens.ts`:

```ts
// Design tokens as plain data — design doc §11, port rule 4. React Native's
// StyleSheet consumes this file directly, so numeric tokens are numbers (px),
// never "16px" strings. Values are the prototype's palette
// (prototype/headroom.html :root).

export const color = {
  canvas: "#F1F1F4",
  bg: "#FFFFFF",
  surface2: "#FAFAFB",
  ink: "#101219",
  ink2: "#6B6F7E",
  ink3: "#9DA1AE",
  line: "#E9EAEF",
  line2: "#F2F3F6",
  violet: "#5B4FE9",
  violetInk: "#463BC9",
  violetBg: "#F2F0FE",
  violetLine: "#DCD7FC",
  green: "#15825A",
  greenBg: "#E8F5EF",
  amber: "#A96605",
  amberBg: "#FCF2E3",
  red: "#C33B31",
  redBg: "#FCEBE9",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
} as const;

export type ColorToken = keyof typeof color;
export type RadiusToken = keyof typeof radius;
export type SpaceToken = keyof typeof space;
```

- [ ] **Step 5: Write the CSS generator and the re-export surface**

Create `packages/tokens/src/css.ts`:

```ts
import { color, radius, space } from "./tokens";

/** violetInk -> violet-ink, ink2 -> ink-2 */
function kebab(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
}

export function cssVariables(): string {
  const lines = [
    ...Object.entries(color).map(([key, value]) => `  --hr-${kebab(key)}: ${value};`),
    ...Object.entries(radius).map(([key, value]) => `  --hr-radius-${key}: ${value}px;`),
    ...Object.entries(space).map(([key, value]) => `  --hr-space-${key}: ${value}px;`),
  ];
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function tokensCss(): string {
  return [
    "/* Generated by `npm run tokens:css` from packages/tokens/src/index.ts.",
    "   Do not edit by hand — edit the tokens and re-run. */",
    "",
    cssVariables(),
  ].join("\n");
}
```

Create `packages/tokens/src/index.ts` — `css.ts` imports from `tokens.ts`, never from here, so there is no import cycle:

```ts
export { color, radius, space } from "./tokens";
export type { ColorToken, RadiusToken, SpaceToken } from "./tokens";
export { cssVariables, tokensCss } from "./css";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- --project tokens`
Expected: PASS — 6 tests.

- [ ] **Step 7: Write the drift test for the generated file**

Create `tests/architecture/tokens-css.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokensCss } from "@headroom/tokens";

const GENERATED = fileURLToPath(new URL("../../src/app/tokens.css", import.meta.url));

describe("src/app/tokens.css", () => {
  it("matches the generator output — run `npm run tokens:css` if this fails", () => {
    expect(readFileSync(GENERATED, "utf8")).toBe(tokensCss());
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npm test -- --project app`
Expected: FAIL — `ENOENT: no such file or directory, open '.../src/app/tokens.css'`.

- [ ] **Step 9: Add the generator script and generate the file**

Install `tsx` at the root:

```bash
npm install -D tsx@^4.19.0
```

Create `scripts/generate-tokens-css.ts`:

```ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensCss } from "@headroom/tokens";

const target = fileURLToPath(new URL("../src/app/tokens.css", import.meta.url));
writeFileSync(target, tokensCss(), "utf8");
console.log(`wrote ${target}`);
```

In `package.json`, add to `"scripts"`:

```json
    "tokens:css": "tsx scripts/generate-tokens-css.ts"
```

Then run it:

```bash
npm install   # links @headroom/tokens into node_modules
npm run tokens:css
```

- [ ] **Step 10: Import the generated file from globals.css**

At the very top of `src/app/globals.css` — CSS requires `@import` before any rule — insert:

```css
@import "./tokens.css";
```

The existing comment block and `:root` stay exactly as they are. The `--hr-*` variables are additive; nothing on the landing page changes.

- [ ] **Step 11: Run everything to verify it passes**

Run: `npm test`
Expected: PASS — projects `app`, `tokens`, `engine-mcp` all green.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 12: Commit**

```bash
git add packages/tokens scripts/generate-tokens-css.ts tests/architecture/tokens-css.test.ts src/app/tokens.css src/app/globals.css package.json package-lock.json
git commit -m "feat: add @headroom/tokens with generated CSS variables"
```

---

## Task 3: packages/contracts

Port rule 3: `packages/contracts` is the single source of truth for the client↔server surface, and Zod runs unchanged in React Native. Schemas here describe the three endpoints that already exist; Task 5 makes the route handlers validate against them.

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/api.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/__tests__/api.test.ts`

**Interfaces:**
- Consumes: the root Vitest runner (Task 1).
- Produces: `@headroom/contracts` exporting the Zod schemas `ApiErrorResponse`, `UserSummary`, `MeResponse`, `UsersResponse`, `HealthResponse`, each with a same-named inferred type. `UserSummary` is `{ id: string (uuid); email: string (email); createdAt: string (ISO 8601) }` — `createdAt` is a **string**, because these describe JSON on the wire, not Prisma rows.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/__tests__/api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ApiErrorResponse,
  HealthResponse,
  MeResponse,
  UserSummary,
  UsersResponse,
} from "../index";

const VALID_USER = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  email: "pranav@example.com",
  createdAt: "2026-08-11T09:30:00.000Z",
};

describe("UserSummary", () => {
  it("accepts a serialized user row", () => {
    expect(UserSummary.parse(VALID_USER)).toEqual(VALID_USER);
  });

  it("rejects a non-uuid id", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, id: "42" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, email: "nope" }).success).toBe(false);
  });

  it("rejects a Date instance — the wire format is an ISO string", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, createdAt: new Date() }).success).toBe(false);
  });
});

describe("MeResponse / UsersResponse", () => {
  it("wraps a single user", () => {
    expect(MeResponse.parse({ user: VALID_USER }).user.email).toBe(VALID_USER.email);
  });

  it("wraps a list of users", () => {
    expect(UsersResponse.parse({ users: [VALID_USER] }).users).toHaveLength(1);
  });

  it("rejects a missing wrapper key", () => {
    expect(MeResponse.safeParse(VALID_USER).success).toBe(false);
  });
});

describe("HealthResponse", () => {
  it("accepts the healthy shape", () => {
    expect(HealthResponse.parse({ status: "ok", db: "connected" })).toEqual({
      status: "ok",
      db: "connected",
    });
  });

  it("accepts the unreachable shape with its message", () => {
    const down = { status: "error", db: "unreachable", message: "ECONNREFUSED" };
    expect(HealthResponse.parse(down)).toEqual(down);
  });

  it("rejects an error shape with no message", () => {
    expect(HealthResponse.safeParse({ status: "error", db: "unreachable" }).success).toBe(false);
  });
});

describe("ApiErrorResponse", () => {
  it("accepts the standard envelope", () => {
    expect(ApiErrorResponse.parse({ error: "Not signed in" }).error).toBe("Not signed in");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --project contracts`
Expected: FAIL — no project named `contracts` ("No test files found").

- [ ] **Step 3: Create the package skeleton**

Create the manifests first — npm cannot install into a workspace it has never seen.

Create `packages/contracts/package.json`:

```json
{
  "name": "@headroom/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

Create `packages/contracts/tsconfig.json` (identical to the tokens one):

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

Create `packages/contracts/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "contracts",
    environment: "node",
  },
});
```

Then install, which resolves `zod` and links the workspace:

```bash
npm install
npm ls zod
```

Expected: `npm ls zod` shows a `4.x` version under `@headroom/contracts`.

- [ ] **Step 4: Write the schemas**

Create `packages/contracts/src/api.ts`:

```ts
// The client<->server contract — design doc §11, port rule 3. These describe
// JSON on the wire, so timestamps are ISO strings, not Date objects. Zod only:
// no Node built-ins, so this file runs unchanged in React Native.
import { z } from "zod";

export const ApiErrorResponse = z.object({
  error: z.string(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

export const UserSummary = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
export type UserSummary = z.infer<typeof UserSummary>;

export const MeResponse = z.object({
  user: UserSummary,
});
export type MeResponse = z.infer<typeof MeResponse>;

export const UsersResponse = z.object({
  users: z.array(UserSummary),
});
export type UsersResponse = z.infer<typeof UsersResponse>;

export const HealthResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    db: z.literal("connected"),
  }),
  z.object({
    status: z.literal("error"),
    db: z.literal("unreachable"),
    message: z.string(),
  }),
]);
export type HealthResponse = z.infer<typeof HealthResponse>;
```

Create `packages/contracts/src/index.ts`:

```ts
export * from "./api";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --project contracts`
Expected: PASS — 11 tests.

If `z.uuid` / `z.email` / `z.iso.datetime` are undefined, npm resolved Zod 3 rather than 4. Check with `npm ls zod` and fix the version range; do not rewrite the schemas to the Zod 3 API.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts package.json package-lock.json
git commit -m "feat: add @headroom/contracts with the v1 API schemas"
```

---

## Task 4: packages/graph

Port rule 6: Prisma is imported only inside `packages/graph`. Today `src/lib/prisma.ts` and `packages/engine-mcp/src/db.ts` each build their own client, and the generated client sits at `src/generated/prisma` — inside the web app. This task moves the client, deletes both singletons, gives the rest of the codebase named query functions instead of raw Prisma, and makes the rule executable.

The Prisma **schema** stays at `prisma/schema.prisma` (see File Structure). Only the generator `output` moves.

**Files:**
- Create: `packages/graph/package.json`
- Create: `packages/graph/tsconfig.json`
- Create: `packages/graph/vitest.config.ts`
- Create: `packages/graph/vitest.setup.ts`
- Create: `packages/graph/src/client.ts`
- Create: `packages/graph/src/users.ts`
- Create: `packages/graph/src/index.ts`
- Create: `packages/graph/src/__tests__/users.test.ts`
- Create: `tests/architecture/prisma-boundary.test.ts`
- Modify: `prisma/schema.prisma:9-12` (generator output path)
- Modify: `.gitignore:41` (`/src/generated/prisma` → `/packages/graph/src/generated`)
- Modify: `next.config.ts` (add `transpilePackages`)
- Modify: `tsconfig.json` (add the `@headroom/*` path mapping)
- Modify: `src/lib/auth.ts` (import from `@headroom/graph`)
- Modify: `src/app/api/health/route.ts`, `src/app/api/users/route.ts` (import from `@headroom/graph`)
- Modify: `Dockerfile` (copy every workspace manifest before `npm ci`)
- Delete: `src/lib/prisma.ts`
- Delete: `packages/engine-mcp/src/db.ts`
- Delete: `packages/engine-mcp/src/__tests__/db.test.ts` (replaced below)
- Create: `packages/engine-mcp/src/__tests__/graph-connection.test.ts`
- Modify: `packages/engine-mcp/package.json` (drop Prisma deps, add `@headroom/graph`)

**Interfaces:**
- Consumes: nothing from Tasks 2–3.
- Produces: `@headroom/graph` exporting
  - `prisma` — the `PrismaClient` singleton, and the `PrismaClient` type.
  - `pingDatabase(): Promise<boolean>` — `SELECT 1`, `false` on any error.
  - `findUserByClerkId(clerkUserId: string): Promise<UserRow | null>`
  - `createUser(input: { clerkUserId: string; email: string }): Promise<UserRow>`
  - `listUsers(): Promise<Array<{ id: string; email: string; createdAt: Date }>>` — newest first.
  - `UserRow` is the full Prisma `user` row (`id`, `clerkUserId`, `email`, `createdAt`). Note `createdAt` is a **`Date`** here — serialization to ISO happens in the route handler (Task 5).

- [ ] **Step 1: Write the failing test**

Create `packages/graph/src/__tests__/users.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createUser, findUserByClerkId, listUsers, pingDatabase, prisma } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("pingDatabase", () => {
  it("returns true against a reachable database", async () => {
    expect(await pingDatabase()).toBe(true);
  });
});

describe("createUser / findUserByClerkId", () => {
  it("round-trips a user", async () => {
    const created = await makeUser("roundtrip");

    const found = await findUserByClerkId(created.clerkUserId);

    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe("roundtrip@example.com");
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("returns null for an unknown clerk id", async () => {
    expect(await findUserByClerkId("user_does_not_exist")).toBeNull();
  });
});

describe("listUsers", () => {
  it("returns users newest first with only the summary fields", async () => {
    const older = await makeUser("older");
    const newer = await makeUser("newer");

    const users = await listUsers();
    const ids = users.map((user) => user.id);

    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(Object.keys(users[0]).sort()).toEqual(["createdAt", "email", "id"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --project graph`
Expected: FAIL — no project named `graph` ("No test files found").

- [ ] **Step 3: Move the generated Prisma client**

In `prisma/schema.prisma`, change the generator block to:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../packages/graph/src/generated/prisma"
}
```

In `.gitignore`, replace the line `/src/generated/prisma` with:

```
/packages/graph/src/generated
```

Then remove the stale output and regenerate:

```bash
rm -rf src/generated
npm run prisma:generate
```

Expected: `packages/graph/src/generated/prisma/client.ts` now exists.

- [ ] **Step 4: Create the package skeleton**

Create `packages/graph/package.json`:

```json
{
  "name": "@headroom/graph",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "dotenv": "^17.4.2",
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

Create `packages/graph/tsconfig.json`:

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

Create `packages/graph/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "graph",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
```

Create `packages/graph/vitest.setup.ts`:

```ts
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
```

- [ ] **Step 5: Write the client and queries**

Create `packages/graph/src/client.ts`:

```ts
// The only file in the repo that imports Prisma — design doc §11, port rule 6.
// Enforced by tests/architecture/prisma-boundary.test.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  headroomPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.headroomPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.headroomPrisma = prisma;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
```

Create `packages/graph/src/users.ts`:

```ts
import { prisma } from "./client";

export type UserRow = {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: Date;
};

export function findUserByClerkId(clerkUserId: string): Promise<UserRow | null> {
  return prisma.user.findUnique({ where: { clerkUserId } });
}

export function createUser(input: { clerkUserId: string; email: string }): Promise<UserRow> {
  return prisma.user.create({ data: input });
}

export function listUsers(): Promise<Array<{ id: string; email: string; createdAt: Date }>> {
  return prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
```

Create `packages/graph/src/index.ts`:

```ts
export { prisma, pingDatabase } from "./client";
export type { PrismaClient } from "./client";
export { createUser, findUserByClerkId, listUsers } from "./users";
export type { UserRow } from "./users";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm install` (links `@headroom/graph`), then `docker compose up -d`, then `npm test -- --project graph`
Expected: PASS — 5 tests.

If `listUsers` ordering is flaky because both rows share a `created_at` millisecond, that is a real ordering weakness in the query, not a test problem — note it and move on; the life-graph plan replaces this query.

- [ ] **Step 7: Write the architecture test for port rule 6**

Create `tests/architecture/prisma-boundary.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCANNED = ["src", "packages", "scripts", "tests"];
// This file names the forbidden patterns, so it must exempt itself.
const SELF = join("tests", "architecture", "prisma-boundary.test.ts");
const ALLOWED_PREFIX = join("packages", "graph");
const FORBIDDEN = [
  /from ["']@prisma\/client["']/,
  /from ["']@prisma\/adapter-pg["']/,
  /generated\/prisma/,
];

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !path.includes("node_modules"));
}

describe("port rule 6 — Prisma is imported only inside packages/graph", () => {
  it("finds no Prisma import outside the graph package", () => {
    const offenders = SCANNED.flatMap(sourceFiles)
      .filter((path) => !path.startsWith(ALLOWED_PREFIX) && path !== SELF)
      .filter((path) => {
        const contents = readFileSync(join(ROOT, path), "utf8");
        return FORBIDDEN.some((pattern) => pattern.test(contents));
      });

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npm test -- --project app`
Expected: FAIL — offenders lists `src/lib/prisma.ts` and `packages/engine-mcp/src/db.ts`.

- [ ] **Step 9: Delete the two old singletons and rewire their callers**

```bash
git rm src/lib/prisma.ts packages/engine-mcp/src/db.ts packages/engine-mcp/src/__tests__/db.test.ts
```

Replace `src/lib/auth.ts` with:

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { createUser, findUserByClerkId, type UserRow } from "@headroom/graph";

/**
 * Returns the Postgres User row for the signed-in Clerk session, creating it
 * on first sight (lazy sync — no Clerk webhook needed). Returns null if
 * there's no signed-in session.
 */
export async function getOrCreateUser(): Promise<UserRow | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await findUserByClerkId(clerkUserId);
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) {
    throw new Error(`Clerk user ${clerkUserId} has no primary email address`);
  }

  return createUser({ clerkUserId, email });
}
```

Replace `src/app/api/health/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { pingDatabase } from "@headroom/graph";

export async function GET() {
  const connected = await pingDatabase();
  if (!connected) {
    return NextResponse.json(
      { status: "error", db: "unreachable", message: "SELECT 1 failed" },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: "ok", db: "connected" });
}
```

Replace `src/app/api/users/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { listUsers } from "@headroom/graph";

export async function GET() {
  const requestor = await getOrCreateUser();
  if (!requestor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json({ users: await listUsers() });
}
```

Create `packages/engine-mcp/src/__tests__/graph-connection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pingDatabase } from "@headroom/graph";

describe("engine graph access", () => {
  it("reaches the database through @headroom/graph", async () => {
    expect(await pingDatabase()).toBe(true);
  });
});
```

In `packages/engine-mcp/package.json`, replace the `"dependencies"` block with:

```json
  "dependencies": {
    "@headroom/graph": "*",
    "@modelcontextprotocol/sdk": "^1.26.0"
  },
```

- [ ] **Step 10: Wire the workspace packages into Next and TypeScript**

Replace `next.config.ts` with:

```ts
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Workspace packages ship TypeScript source, not build output — design doc §11.
  transpilePackages: ["@headroom/contracts", "@headroom/graph", "@headroom/tokens"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
```

In `tsconfig.json`, extend `compilerOptions.paths` to:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@headroom/*": ["./packages/*/src"]
    }
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npm install`, then `npm test`
Expected: PASS — projects `app`, `tokens`, `contracts`, `graph`, `engine-mcp` all green, and `prisma-boundary` reports no offenders.

- [ ] **Step 12: Verify the production build still traces the Prisma client**

Run:

```bash
npm run build
find .next/standalone -path '*generated/prisma*' -name '*.js' | head -3
```

Expected: the build succeeds and `find` prints at least one path. An empty result means Next did not trace the generated client into the standalone bundle and the container will fail at runtime — stop and fix before continuing.

- [ ] **Step 13: Make the Docker build workspace-aware**

`npm ci` runs before the workspace sources are copied, so every workspace manifest must be present at that layer. In `Dockerfile`, replace:

```dockerfile
COPY package*.json ./
RUN npm ci
```

with:

```dockerfile
# npm ci needs every workspace manifest present, not just the root one.
COPY package*.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/engine-mcp/package.json ./packages/engine-mcp/
COPY packages/graph/package.json ./packages/graph/
COPY packages/tokens/package.json ./packages/tokens/
RUN npm ci
```

- [ ] **Step 14: Verify the image builds**

Run:

```bash
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder -t headroom-foundation-check .
```

Expected: build completes. (It is not run — `migrate deploy` needs a real database.)

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "refactor: confine Prisma to @headroom/graph and enforce port rule 6"
```

---

## Task 5: Version every route under /api/v1

Port rule 1: `/api/v1/*` route handlers only, versioned from the first commit. Three routes exist at unversioned paths. Moving them now costs three file moves; after the connector and brief endpoints land it costs a migration.

Route handlers also start validating their own responses against `@headroom/contracts` before returning, which makes port rule 3 load-bearing rather than aspirational.

No HTTP health probe is configured in `.github/workflows/deploy.yml` or on the Container App, so nothing external depends on `/api/health`. No compatibility aliases are kept.

**Files:**
- Create: `src/app/api/v1/health/route.ts`
- Create: `src/app/api/v1/me/route.ts`
- Create: `src/app/api/v1/users/route.ts`
- Create: `src/app/api/v1/__tests__/routes.test.ts`
- Create: `tests/architecture/api-versioning.test.ts`
- Delete: `src/app/api/health/route.ts`, `src/app/api/me/route.ts`, `src/app/api/users/route.ts`
- Modify: `package.json` (add `@headroom/contracts`, `@headroom/graph`, and `@headroom/tokens` to `dependencies`)

**Interfaces:**
- Consumes: `@headroom/contracts` (`HealthResponse`, `MeResponse`, `UsersResponse`) from Task 3; `@headroom/graph` (`listUsers`, `pingDatabase`) from Task 4.
- Produces: `GET /api/v1/health`, `GET /api/v1/me`, `GET /api/v1/users`. Every 200 body parses against its contract; every 401 body is `{ error: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v1/__tests__/routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthResponse, MeResponse, UsersResponse } from "@headroom/contracts";

const getOrCreateUser = vi.fn();
const listUsers = vi.fn();
const pingDatabase = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
}));

const USER_ROW = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  clerkUserId: "user_abc",
  email: "pranav@example.com",
  createdAt: new Date("2026-08-11T09:30:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/health", () => {
  it("returns a contract-valid ok body when the database answers", async () => {
    pingDatabase.mockResolvedValue(true);
    const { GET } = await import("../health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(HealthResponse.parse(await response.json())).toEqual({
      status: "ok",
      db: "connected",
    });
  });

  it("returns 503 with a contract-valid error body when it does not", async () => {
    pingDatabase.mockResolvedValue(false);
    const { GET } = await import("../health/route");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(HealthResponse.parse(await response.json()).status).toBe("error");
  });
});

describe("GET /api/v1/me", () => {
  it("serializes createdAt as an ISO string", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../me/route");

    const response = await GET();
    const body = MeResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.user.createdAt).toBe("2026-08-11T09:30:00.000Z");
  });

  it("does not leak the Clerk user id", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../me/route");

    expect(await (await GET()).json()).not.toHaveProperty("user.clerkUserId");
  });

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../me/route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });
});

describe("GET /api/v1/users", () => {
  it("returns a contract-valid list", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    listUsers.mockResolvedValue([
      { id: USER_ROW.id, email: USER_ROW.email, createdAt: USER_ROW.createdAt },
    ]);
    const { GET } = await import("../users/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(UsersResponse.parse(await response.json()).users).toHaveLength(1);
  });

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../users/route");

    expect((await GET()).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --project app`
Expected: FAIL — `Cannot find module '../health/route'`.

- [ ] **Step 3: Declare the workspace dependencies of the web app**

In the root `package.json`, add to `"dependencies"`:

```json
    "@headroom/contracts": "*",
    "@headroom/graph": "*",
    "@headroom/tokens": "*",
```

Then run `npm install`.

- [ ] **Step 4: Create the versioned routes**

Create `src/app/api/v1/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { HealthResponse } from "@headroom/contracts";
import { pingDatabase } from "@headroom/graph";

export async function GET() {
  if (!(await pingDatabase())) {
    return NextResponse.json(
      HealthResponse.parse({
        status: "error",
        db: "unreachable",
        message: "SELECT 1 failed",
      }),
      { status: 503 },
    );
  }

  return NextResponse.json(HealthResponse.parse({ status: "ok", db: "connected" }));
}
```

Create `src/app/api/v1/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { MeResponse } from "@headroom/contracts";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Only the contract's fields cross the wire — clerkUserId stays server-side.
  return NextResponse.json(
    MeResponse.parse({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    }),
  );
}
```

Create `src/app/api/v1/users/route.ts`:

```ts
import { NextResponse } from "next/server";
import { UsersResponse } from "@headroom/contracts";
import { listUsers } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  const requestor = await getOrCreateUser();
  if (!requestor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const users = await listUsers();

  return NextResponse.json(
    UsersResponse.parse({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      })),
    }),
  );
}
```

- [ ] **Step 5: Delete the unversioned routes**

```bash
git rm src/app/api/health/route.ts src/app/api/me/route.ts src/app/api/users/route.ts
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- --project app`
Expected: PASS — 7 route tests plus the earlier `app` tests.

- [ ] **Step 7: Write the architecture test for port rule 1**

Create `tests/architecture/api-versioning.test.ts`:

```ts
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const API_DIR = join(ROOT, "src", "app", "api");
const VERSIONED_PREFIX = ["src", "app", "api", "v1"].join(sep);

function routeFiles(): string[] {
  return readdirSync(API_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === "route.ts")
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)));
}

describe("port rule 1 — every route handler is versioned", () => {
  it("finds no route.ts outside src/app/api/v1", () => {
    const unversioned = routeFiles().filter((path) => !path.startsWith(VERSIONED_PREFIX));

    expect(unversioned).toEqual([]);
  });

  it("still has the three v1 routes", () => {
    expect(routeFiles().sort()).toEqual([
      join(VERSIONED_PREFIX, "health", "route.ts"),
      join(VERSIONED_PREFIX, "me", "route.ts"),
      join(VERSIONED_PREFIX, "users", "route.ts"),
    ]);
  });
});
```

- [ ] **Step 8: Run everything to verify it passes**

Run: `npm test`
Expected: PASS — all five projects.

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move every route under /api/v1 and validate against contracts"
```

---

## Task 6: Finish the teardown

§12's deletions are done except for the product's public face: the landing page still sells Safe-to-Pay to Schedule C freelancers, the README still describes the cashflow decision engine and links six deleted docs, and a 122 KB cashflow prototype sits in the repo root. This task replaces the copy with the §2 pitch and adds the test that keeps it gone.

**Files:**
- Create: `tests/architecture/teardown.test.ts`
- Modify: `src/components/landing/LandingNav.tsx`, `Hero.tsx`, `MockCard.tsx`, `TrustBar.tsx`, `Problem.tsx`, `HowItWorks.tsx`, `FeatureCards.tsx`, `LandingFooter.tsx`
- Modify: `src/app/layout.tsx` (metadata description)
- Modify: `src/app/globals.css:3` (header comment naming the deleted prototype)
- Modify: `docker-compose.yml`, `.env.example` (local Postgres user/password/database name)
- Modify: `prisma/schema.prisma:1-7` and the comment block above `CheckIn`
- Rewrite: `README.md`
- Delete: `cashflow-companion (5).html`

**Interfaces:**
- Consumes: nothing. Copy-only, plus one test.
- Produces: no exports. The landing page renders the commitments-vs-capacity pitch; `tests/architecture/teardown.test.ts` fails if cashflow vocabulary reappears in `src/`, `packages/`, `prisma/`, `scripts/`, or `README.md`.

- [ ] **Step 1: Write the failing test**

Create `tests/architecture/teardown.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// docs/ and prototype/ are historical artifacts and are deliberately exempt.
const SCANNED_DIRS = ["src", "packages", "prisma", "scripts", "tests"];
const SCANNED_FILES = ["README.md", "CLAUDE.md"];
// This file spells out the forbidden words, so it must exempt itself.
const SELF = join("tests", "architecture", "teardown.test.ts");

const DEAD_VOCABULARY = [
  /cashflow/i,
  /safe-to-pay/i,
  /schedule c/i,
  /plaid/i,
  /tax-bomb/i,
  /runway floor/i,
];

function filesToScan(): string[] {
  const fromDirs = SCANNED_DIRS.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(tsx?|css|md|prisma)$/.test(entry.name))
      .map((entry) => relative(ROOT, join(entry.parentPath, entry.name))),
  );
  return [...fromDirs, ...SCANNED_FILES].filter(
    (path) => !path.includes("node_modules") && !path.includes("generated") && path !== SELF,
  );
}

describe("teardown — design doc §12", () => {
  it("has no cashflow vocabulary left in shipped code, schema, or the README", () => {
    const offenders = filesToScan().filter((path) => {
      const contents = readFileSync(join(ROOT, path), "utf8");
      return DEAD_VOCABULARY.some((pattern) => pattern.test(contents));
    });

    expect(offenders).toEqual([]);
  });

  it("no longer carries the cashflow prototype in the repo root", () => {
    expect(() => statSync(join(ROOT, "cashflow-companion (5).html"))).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --project app`
Expected: FAIL — offenders lists the landing components, `src/app/globals.css`, `prisma/schema.prisma`, and `README.md`; the second test fails because the prototype file still exists.

- [ ] **Step 3: Rewrite the landing navigation and hero**

In `src/components/landing/LandingNav.tsx`, replace the brand subtitle line:

```tsx
          <div className={styles.sub}>Safe-to-Pay, defended.</div>
```

with:

```tsx
          <div className={styles.sub}>Everything you owe, in one place.</div>
```

Replace `src/components/landing/Hero.tsx` with:

```tsx
import styles from "./Landing.module.css";
import { MockCard } from "./MockCard";
import { SignUpCta } from "./SignUpCta";

export function Hero() {
  return (
    <div className={styles.lpHero}>
      <div>
        <div className={styles.lpEyebrow}>For people who owe more people than they can track</div>
        <h1 className="serif">
          Know what you actually <em>owe.</em> Before it&rsquo;s late.
        </h1>
        <p className={styles.lpSub}>
          Every commitment you&rsquo;ve made lives in a different app, and none of them know
          how much you have left in the tank. Headroom reads your email, GitHub and
          calendar, extracts every promise{" "}
          <b>with a citation to exactly where you made it</b>, and tells you each morning
          what&rsquo;s actually at risk.
        </p>
        <div className={styles.lpCta}>
          <SignUpCta className="btn primary lg">Connect your accounts</SignUpCta>
        </div>
      </div>
      <MockCard />
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the hero mock card**

Replace `src/components/landing/MockCard.tsx` with:

```tsx
import styles from "./Landing.module.css";
import { WarnIcon } from "./icons";

export function MockCard() {
  return (
    <div className={styles.lpMock}>
      <div className={styles.float}>
        <div className={styles.mockCard}>
          <span className={styles.mockBadge}>
            <WarnIcon /> Needs you
          </span>
          <div className={styles.mockLbl}>At risk today</div>
          <div className={`${styles.mockNum} mono`}>2</div>
          <div className={styles.mockRange}>
            of <b className="mono">14</b> open commitments · every one quoted from source
          </div>
          <div className={styles.mockFoot}>
            <span className={styles.hpill}>Gmail</span>
            <span className={styles.hpill}>GitHub</span>
            <span className={styles.hpill}>Calendar</span>
          </div>
        </div>
        <div className={styles.mockChip}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", fontWeight: 700 }}>
            Reads &amp; drafts
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
            Nothing sends without your tap.
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the trust bar**

Replace the three `trustItem` blocks in `src/components/landing/TrustBar.tsx` — the imports, wrapper elements, and icon usage stay exactly as they are:

```tsx
        <div className={styles.trustItem}>
          <ShieldIcon />
          <div>
            <div className={styles.tk}>It drafts. You send.</div>
            <div className={styles.tv}>Anything outward-facing is one tap, always. That isn&rsquo;t a setting you can switch off.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <FileIcon />
          <div>
            <div className={styles.tk}>Every claim carries its receipt.</div>
            <div className={styles.tv}>A commitment is only shown if it traces to a real message — the quote, the timestamp, and a link back.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <DocIcon />
          <div>
            <div className={styles.tk}>The engine computes. The model phrases.</div>
            <div className={styles.tv}>No date, count, or score is ever invented by a language model.</div>
          </div>
        </div>
```

- [ ] **Step 6: Rewrite the problem and how-it-works sections**

Replace the `<h2>` and `<p>` inside `src/components/landing/Problem.tsx`:

```tsx
        <h2 className="serif">Your commitments are scattered across five apps. Your capacity lives in none of them.</h2>
        <p className={styles.lead}>
          You promised a review in a PR comment, a doc by Thursday in the fourth paragraph
          of an email thread, and a call back to someone while you were out walking. Each
          app knows its own slice; none of them knows your week. So the thing that slips is
          never the thing you were tracking — <b>it&rsquo;s the promise you made in prose
          three Tuesdays ago</b> and never wrote down anywhere.
        </p>
```

Replace the three `step` blocks in `src/components/landing/HowItWorks.tsx`, and the `<h2>`:

```tsx
        <h2 className="serif">Read, weigh, and surface only what needs you.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.sn}>1</div>
            <h3>Read &amp; extract</h3>
            <p>It reads your email, GitHub and calendar and pulls out every promise you made — each one quoted from where you actually made it. Unsure ones come to you for a one-tap confirm.</p>
            <span className={styles.tag}>AI · judgment</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>2</div>
            <h3>Weigh against capacity</h3>
            <p>A deterministic engine owns the arithmetic: hours promised against hours free, what&rsquo;s due when, and what&rsquo;s blocking what. Same inputs, same answer — every time.</p>
            <span className={styles.tag}>Engine · arithmetic</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>3</div>
            <h3>Surface what&rsquo;s at risk</h3>
            <p>Each morning it surfaces only the commitments that need you, with the reply already drafted — or it stays quiet.</p>
            <span className={styles.tag}>Earned attention</span>
          </div>
        </div>
```

- [ ] **Step 7: Rewrite the feature cards and footer**

Replace `src/components/landing/FeatureCards.tsx` with:

```tsx
import styles from "./Landing.module.css";
import { SignUpCta } from "./SignUpCta";

export function FeatureCards() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.lpTwo}>
          <div className={styles.featureCard}>
            <div className={styles.secEyebrow}>The AI-hard part</div>
            <h3>Promises don&rsquo;t announce themselves.</h3>
            <p>
              &ldquo;I&rsquo;ll get you the draft by Thursday,&rdquo; buried in the fourth
              paragraph of a thread, is a commitment. &ldquo;I&rsquo;ll take a look&rdquo;
              is not. Headroom won&rsquo;t record one until it can quote the sentence it
              came from — and when it isn&rsquo;t sure, it asks.
            </p>
            <div className={styles.miniTxn}>
              <div className={styles.amt}>&ldquo;I&rsquo;ll send the revised deck Thursday&rdquo;</div>
              <div className={styles.q}>thread with Maya R. — is this a commitment?</div>
              <div className={styles.miniConf}>
                <i />
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, fontFamily: "var(--font-tabular)" }}>
                confidence 61% · escalated for confirm
              </div>
            </div>
          </div>
          <div className={`${styles.featureCard} ${styles.amber}`}>
            <div className={styles.secEyebrow} style={{ color: "var(--amber)" }}>The catch</div>
            <h3>It sees the crunch before you do.</h3>
            <p>
              Thursday has three deliverables and four hours of meetings booked over them.
              Headroom flags the collision on Monday, while it&rsquo;s still fixable — and
              tells you which promise to move, not just that you&rsquo;re busy.
            </p>
            <div style={{ marginTop: 20 }}>
              <SignUpCta className="btn primary">See the catch →</SignUpCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Replace the two `<span>` lines in `src/components/landing/LandingFooter.tsx`:

```tsx
        <span>Early build · reads your accounts, drafts on your behalf, sends nothing without a tap.</span>
        <span>Every claim links back to the message it came from.</span>
```

- [ ] **Step 8: Update the metadata, stylesheet header, local database name, and schema comments**

In `src/app/layout.tsx`, replace the metadata block:

```tsx
export const metadata: Metadata = {
  title: "Headroom",
  description: "Everything you owe, weighed against what you have left.",
};
```

In `src/app/globals.css`, replace the third line of the header comment — it names the deleted prototype file:

```css
   Ported from prototype/headroom.html.
```

Rename the local Postgres. In `docker-compose.yml`, replace the three `environment` values:

```yaml
      POSTGRES_USER: headroom
      POSTGRES_PASSWORD: headroom
      POSTGRES_DB: headroom
```

In `.env.example`, replace the first line to match:

```
DATABASE_URL="postgresql://headroom:headroom@localhost:5432/headroom?schema=public"
```

Then recreate the local volume and re-apply migrations — the old volume holds a database under the old name, so skipping this leaves every DB-backed test failing on connect:

```bash
docker compose down -v && docker compose up -d
```

Update the `DATABASE_URL` line in your own `.env` to the same value, then:

```bash
npm run prisma:migrate
```

In `prisma/schema.prisma`, replace the header comment (lines 1–7) with:

```prisma
// Headroom — Prisma schema
//
// Surviving models from the pre-pivot schema: the agent-run audit chain, kept
// because it is already the right shape for the Ledger. See
// docs/superpowers/specs/2026-08-11-headroom-commitments-design.md §5.
// The life graph (Person, Commitment, Artifact, ...) is not modeled here yet
// — it lands in the life-graph implementation plan.
```

Also update the comment block above `CheckIn` (currently around lines 110–113) which mentions the deleted `Plan` model:

```prisma
// CheckIn and RecommendationOutcome both had a required relation to a model
// deleted in the pivot. Only the offending relation fields were stripped; the
// rest of each model survives mechanically unchanged, ready to be re-pointed
// at a future Commitment/Brief model.
```

- [ ] **Step 9: Delete the old prototype and rewrite the README**

```bash
git rm "cashflow-companion (5).html"
```

Replace `README.md` entirely with:

```markdown
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
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — every project, including the DB-backed `graph` and `engine-mcp` projects against the recreated Postgres, and the teardown test reports no offenders.

- [ ] **Step 11: Verify the page still renders**

Run: `npm run dev`, open `http://localhost:3000`, and confirm the hero, trust bar, problem, how-it-works, feature cards, and footer all render with the new copy and no layout breakage. Then stop the dev server.

Run: `npm run build && npm run lint && npm test`
Expected: all three succeed.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: replace cashflow copy with the commitments pitch and gate it with a test"
```

---

## Done when

- `npm test` passes with five projects: `app`, `contracts`, `graph`, `tokens`, `engine-mcp`.
- `npm run build` and `npm run lint` pass.
- `docker build` succeeds with the workspace manifests copied.
- `tests/architecture/` enforces port rule 1, port rule 6, the token/CSS single source of truth, and the teardown.
- No file outside `packages/graph` imports Prisma; no `route.ts` sits outside `src/app/api/v1`.
- The landing page and README describe commitments vs. capacity.

**Next plan:** the life graph — §5's `Person`, `Identity`, `Artifact`, `Commitment`, `CommitmentEvent`, `CapacitySignal`, `Action`, `Label`, plus connector cursors and the deterministic belief-invalidation rules, all inside `packages/graph`.
