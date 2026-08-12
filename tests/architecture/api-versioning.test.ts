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

  it("still has the six v1 routes", () => {
    expect(routeFiles().sort()).toEqual([
      join(VERSIONED_PREFIX, "agent", "think", "citations", "route.ts"),
      join(VERSIONED_PREFIX, "agent", "think", "route.ts"),
      join(VERSIONED_PREFIX, "health", "route.ts"),
      join(VERSIONED_PREFIX, "me", "route.ts"),
      join(VERSIONED_PREFIX, "users", "route.ts"),
      join(VERSIONED_PREFIX, "voice", "agent-token", "route.ts"),
    ]);
  });
});
