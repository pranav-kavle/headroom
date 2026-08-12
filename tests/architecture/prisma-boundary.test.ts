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
