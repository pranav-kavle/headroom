import { describe, expect, it } from "vitest";
import { engineTools } from "@headroom/engine-mcp";

// The tier gate only protects a tool that declares a tier — an undeclared
// tier means "this is a read", and the loop runs it with no approval at all.
// That is correct for get_state and get_weather, and catastrophic for
// anything that writes to a third party.
//
// This exists because the failure it guards against is invisible: a new send
// tool with no `tier` would simply work, in the worst possible sense, and no
// existing test would notice.

// Every tool whose handler causes a side effect somebody else can see.
// Adding an outward-facing tool means adding it here, which is the point:
// the omission has to be deliberate rather than accidental.
const OUTWARD_FACING = ["comment_on_pr", "close_pr", "merge_pr", "send_slack_message"];

describe("outward-facing tools are gated", () => {
  it("declares a tier on every outward-facing tool", () => {
    const tools = engineTools();

    for (const name of OUTWARD_FACING) {
      const tool = tools.find((t) => t.name === name);
      expect(tool, `${name} is not registered`).toBeDefined();
      expect(tool?.tier, `${name} has no tier and would run ungated`).toBeDefined();
    }
  });

  it("puts every outward-facing tool at tier 2 or above", () => {
    const tools = engineTools();

    for (const name of OUTWARD_FACING) {
      const tier = tools.find((t) => t.name === name)?.tier;
      expect(tier, `${name} is below tier 2`).not.toBe("tier_1");
    }
  });

  // The inverse: a tool that reaches a third party but was never listed above
  // would slip through both checks. Anything marked `external` that writes is
  // the population we care about, and `external` reads are exempt by name.
  it("has no untiered tool that is not a known read", () => {
    const KNOWN_READS = [
      "get_weather",
      "get_events",
      "get_flight_status",
      "check_github",
      "check_slack",
      "list_slack_channels",
    ];

    const untieredExternal = engineTools()
      .filter((tool) => tool.external && !tool.tier)
      .map((tool) => tool.name)
      .filter((name) => !KNOWN_READS.includes(name));

    expect(untieredExternal).toEqual([]);
  });
});
