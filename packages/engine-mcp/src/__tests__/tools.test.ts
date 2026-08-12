import { describe, expect, it } from "vitest";
import { engineTools, type EngineContext } from "../tools";
import type { StateCommitmentInput } from "../tools/state";

const NOW = new Date("2026-08-12T09:30:00Z");

function commitment(over: Partial<StateCommitmentInput> = {}): StateCommitmentInput {
  return {
    id: "c1",
    direction: "owed_by_me",
    summary: "Send Maya the deck",
    status: "open",
    dueAt: new Date("2026-08-13T00:00:00Z"),
    duePrecision: "day",
    quote: "I told Maya I'd get her the deck by Thursday",
    sourceArtifactId: "a1",
    counterpartyPerson: { displayName: "Maya Rodriguez" },
    ...over,
  };
}

function context(commitments: StateCommitmentInput[] = []): EngineContext {
  return {
    userId: "u1",
    now: NOW,
    listCommitments: async () => commitments,
  };
}

function toolNamed(name: string) {
  const tool = engineTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

describe("engineTools", () => {
  it("exposes the engine tools built so far, under their design-doc §7 names", () => {
    expect(engineTools().map((t) => t.name).sort()).toEqual(["get_action_policy", "get_state"]);
  });

  // The portability contract: plain JSON Schema, no SDK coupling, so the same
  // definitions feed the Anthropic Tool Runner today and Deepgram's Voice Agent
  // function calling later.
  it("describes every tool with a plain JSON Schema object", () => {
    for (const tool of engineTools()) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).not.toHaveProperty("_def"); // a Zod schema would have this
    }
  });
});

describe("get_state handler", () => {
  it("returns engine-computed state for the context's user", async () => {
    const result = await toolNamed("get_state").handler({}, context([commitment()]));

    expect(result).toMatchObject({
      today: "2026-08-12",
      counts: { owedByMe: 1, owedToMe: 0 },
    });
  });

  it("passes the context's userId to the graph, never a model-supplied one", async () => {
    let askedFor: string | undefined;
    const ctx: EngineContext = {
      userId: "real-user",
      now: NOW,
      listCommitments: async (userId) => {
        askedFor = userId;
        return [];
      },
    };

    await toolNamed("get_state").handler({ userId: "attacker" }, ctx);

    expect(askedFor).toBe("real-user");
  });
});

describe("get_action_policy handler", () => {
  it("returns the deterministic policy for a tier", async () => {
    const result = await toolNamed("get_action_policy").handler(
      { tier: "tier_3", kind: "book_flight" },
      context(),
    );

    expect(result).toEqual({ policy: "forbidden" });
  });

  it("rejects a tier outside the known set rather than guessing", async () => {
    await expect(
      toolNamed("get_action_policy").handler({ tier: "tier_9" }, context()),
    ).rejects.toThrow(/tier/i);
  });
});
