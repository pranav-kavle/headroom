import { describe, expect, it } from "vitest";
import { getActionPolicy } from "../tools/action-policy";

// Design doc §8's policy table, and CLAUDE.md's gate: "Tier 1 autonomy is only
// enabled once the extraction precision bar (≥90% precision on owed_by_me,
// design doc §6) is met." That bar is unmet — no eval harness exists — so the
// default must not be `allowed`.
describe("getActionPolicy", () => {
  it("holds tier 1 for approval until the precision bar is met", () => {
    expect(getActionPolicy("tier_1")).toBe("needs_approval");
  });

  it("allows tier 1 unattended once the precision bar is met", () => {
    expect(getActionPolicy("tier_1", { tier1Unattended: true })).toBe("allowed");
  });

  it("always requires approval for tier 2, regardless of the tier 1 gate", () => {
    expect(getActionPolicy("tier_2")).toBe("needs_approval");
    expect(getActionPolicy("tier_2", { tier1Unattended: true })).toBe("needs_approval");
  });

  it("forbids tier 3 — prepared, never executed", () => {
    expect(getActionPolicy("tier_3")).toBe("forbidden");
    expect(getActionPolicy("tier_3", { tier1Unattended: true })).toBe("forbidden");
  });

  it("forbids tier 4 while the code-access decision is deferred", () => {
    expect(getActionPolicy("tier_4")).toBe("forbidden");
  });
});
