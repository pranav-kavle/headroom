import { describe, expect, it } from "vitest";
import { engineTools } from "@headroom/engine-mcp";
import { POLICY_PROMPT } from "@/lib/agent";

// The prompt does not enumerate the tool registry.
//
// It used to: a "Live lookups" paragraph named get_weather, get_events, and
// get_flight_status and restated what each was for. Three problems, and only
// the first is about tokens:
//
//   1. It grows with the registry. §16's capability backlog is ~26 read
//      domains and ~13 write ones. A paragraph that has to gain a clause per
//      tool is unmaintainable well before that, and past ~15-20 tools the
//      answer is tool *selection*, not a longer prompt.
//   2. It is a second source of truth for routing, which already lives in the
//      tool description — two places to change one behaviour, and they drift.
//   3. It invalidates the cache it sits in. POLICY_PROMPT is the cached block
//      (2026-08-13 spec §4); naming tools inside it means every registry
//      change busts the prefix that block exists to protect.
//
// So: what a tool does and when to reach for it belongs in its description.
// What the *system* requires belongs here. get_state and get_action_policy are
// named because rules refer to them — "call get_state before any claim",
// "you do not decide your own autonomy" are core rules 1 and 3, not routing —
// and they are a fixed pair. Everything else must earn its way in by being
// policy, which in practice means nothing does.
const POLICY_BEARING = new Set(["get_state", "get_action_policy"]);

describe("the policy prompt does not enumerate the tool registry", () => {
  it("names no tool beyond the two the core rules are written in terms of", () => {
    const named = engineTools()
      .map((tool) => tool.name)
      .filter((name) => POLICY_PROMPT.includes(name))
      .filter((name) => !POLICY_BEARING.has(name));

    expect(named).toEqual([]);
  });

  // The rule that scales: a live third-party lookup is routing, never policy.
  // Adding the twentieth one must require no prompt edit at all.
  it("names no live third-party lookup", () => {
    const external = engineTools()
      .filter((tool) => tool.external)
      .map((tool) => tool.name)
      .filter((name) => POLICY_PROMPT.includes(name));

    expect(external).toEqual([]);
  });

  // The class rule still has to be stated — that the commitment constraints
  // scope to the user's life and not to the world — because it is policy and
  // generalizes over every tool, present and future.
  it("still scopes the commitment constraints away from live world data", () => {
    expect(POLICY_PROMPT).toMatch(/live, real-world|real-world information/i);
    expect(POLICY_PROMPT).toMatch(/do not apply|don't apply/i);
  });

  // If the prompt no longer says when to call these, the descriptions must.
  it("leaves every live lookup self-describing, with its own freshness rule", () => {
    for (const tool of engineTools().filter((t) => t.external)) {
      expect(tool.description, `${tool.name} should say when to call it`).toMatch(/call this/i);
      expect(
        tool.description,
        `${tool.name} should say why memory is not good enough`,
      ).toMatch(/not trained on today/i);
    }
  });
});
