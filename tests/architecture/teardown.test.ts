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
