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
