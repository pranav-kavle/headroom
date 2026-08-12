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
