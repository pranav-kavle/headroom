import { describe, expect, it } from "vitest";
import { engineTools } from "@headroom/engine-mcp";
import { POLICY_PROMPT } from "@/lib/agent";

// An offer only exists if it was made by calling the tool.
//
// §8's "one tap" is implemented as two identical calls in two different runs:
// the first is refused and recorded as a proposal, and the second — after the
// user says yes — matches that proposal and executes. Every part of that is
// deterministic and lives in the loop's gate. The one thing the engine cannot
// do is make the first call happen.
//
// That is where this broke, and it broke asymmetrically, which is why it took
// so long to see. `comment_on_pr` and `send_slack_message` carry text the model
// has to compose, so it called them to commit to the wording and a proposal got
// recorded as a side effect. `merge_pr` and `close_pr` take nothing but an id,
// so there was nothing to draft — the model asked `get_action_policy`, was told
// "needs_approval", and offered *out loud*. Nothing reached the engine. The
// user's "yes" then arrived as the first call, was refused like any first call,
// and the model faithfully reported that the merge had not gone through. It
// read as a policy refusal and was nothing of the kind.
//
// So the rule these tests hold: a tool whose only argument is an id must be
// offered exactly the way one carrying a draft is — by calling it. Anything
// that lets the model believe it can offer without calling brings the bug back
// for the next id-only tool somebody adds.

const TIERED = engineTools().filter((tool) => tool.tier);

describe("offering an action means calling its tool", () => {
  it("tells the model that the call is how it asks", () => {
    expect(POLICY_PROMPT).toMatch(/calling (its |the )?tool|the call is how you ask/i);
  });

  // The specific regression: an instruction to consult the policy tool *before*
  // acting is what gave the model a way to offer without ever touching the gate.
  it("does not make get_action_policy a precondition for acting", () => {
    expect(POLICY_PROMPT).not.toMatch(
      /call\s+`?get_action_policy`?[^.]*before\s+(propos|offer|acting|any action)/i,
    );
  });

  // ...and it must still be reachable for phrasing, or the model has no way to
  // describe a rule accurately. Core rule 3 is about who decides, not about
  // whether the model may know.
  it("keeps get_action_policy available for wording", () => {
    expect(POLICY_PROMPT).toMatch(/get_action_policy/);
  });

  it("has every gated tool instruct the two-call flow", () => {
    for (const tool of TIERED) {
      expect(tool.description, `${tool.name} should tell the model to call it`).toMatch(/call (this|it|again)/i);
      expect(
        tool.description,
        `${tool.name} should say the first call comes back needing approval`,
      ).toMatch(/approval/i);
      expect(
        tool.description,
        `${tool.name} should say a confirmed call repeats the same arguments`,
      ).toMatch(/identical arguments|same arguments/i);
    }
  });

  // The population that actually regressed: nothing to draft, so nothing but an
  // explicit instruction makes the model call before confirming.
  it("tells every id-only gated tool to call straight away", () => {
    const idOnly = TIERED.filter((tool) => {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      return properties.length === 1 && properties[0] === "artifactId";
    });

    // If this ever empties out, the check below is silently testing nothing.
    expect(idOnly.map((t) => t.name)).toEqual(expect.arrayContaining(["merge_pr", "close_pr"]));

    for (const tool of idOnly) {
      expect(
        tool.description,
        `${tool.name} takes only an id, so it must say to call it straight away`,
      ).toMatch(/straight away|nothing to draft/i);
    }
  });
});
