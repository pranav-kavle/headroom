import { describe, expect, it, vi } from "vitest";
import type { EngineContext, EngineTool } from "@headroom/engine-mcp";
import { runAgentTurn, type MessageCreator } from "../agent-loop";

const CONTEXT: EngineContext = {
  userId: "u1",
  now: new Date("2026-08-12T09:30:00Z"),
  listCommitments: async () => [],
};

function textReply(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

function toolReply(name: string, input: Record<string, unknown> = {}) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tu_1", name, input }],
  };
}

function creator(...replies: unknown[]): MessageCreator {
  const create = vi.fn();
  for (const reply of replies) create.mockResolvedValueOnce(reply);
  return { create } as unknown as MessageCreator;
}

const echoTool: EngineTool = {
  name: "get_state",
  description: "test",
  inputSchema: { type: "object" },
  handler: async () => ({
    today: "2026-08-12",
    openCommitments: [
      { id: "c1", quote: "I owe Maya the deck", sourceArtifactId: "a1", summary: "deck" },
    ],
    counts: { owedByMe: 1, owedToMe: 0 },
  }),
};

describe("runAgentTurn", () => {
  it("returns the model's text when it answers without a tool", async () => {
    const result = await runAgentTurn({
      transcript: "hello",
      context: CONTEXT,
      client: creator(textReply("Nothing on file.")),
      tools: [echoTool],
    });

    expect(result.text).toBe("Nothing on file.");
  });

  it("executes a tool call and feeds the result back for a second turn", async () => {
    const client = creator(toolReply("get_state"), textReply("You owe Maya the deck."));

    const result = await runAgentTurn({
      transcript: "what do I owe?",
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    expect(result.text).toBe("You owe Maya the deck.");
    expect(client.create).toHaveBeenCalledTimes(2);
  });

  // Core rule 2: voice carries the claim, the screen carries the evidence.
  // Citations come off the tool result, never off the model's prose.
  it("collects citations from tool results", async () => {
    const result = await runAgentTurn({
      transcript: "what do I owe?",
      context: CONTEXT,
      client: creator(toolReply("get_state"), textReply("You owe Maya the deck.")),
      tools: [echoTool],
    });

    expect(result.citations).toEqual([{ artifactId: "a1", quote: "I owe Maya the deck" }]);
  });

  it("surfaces a refusal instead of returning empty text", async () => {
    const result = await runAgentTurn({
      transcript: "hello",
      context: CONTEXT,
      client: creator({ stop_reason: "refusal", content: [] }),
      tools: [echoTool],
    });

    expect(result.refused).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("returns a tool error to the model rather than aborting the turn", async () => {
    const exploding: EngineTool = {
      ...echoTool,
      handler: async () => {
        throw new Error("engine exploded");
      },
    };
    const client = creator(toolReply("get_state"), textReply("Something went wrong."));

    const result = await runAgentTurn({
      transcript: "what do I owe?",
      context: CONTEXT,
      client,
      tools: [exploding],
    });

    expect(result.text).toBe("Something went wrong.");
    const secondCall = (client.create as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(JSON.stringify(secondCall.messages)).toMatch(/engine exploded/);
  });

  it("stops after a bounded number of turns rather than looping forever", async () => {
    const client = creator(
      toolReply("get_state"),
      toolReply("get_state"),
      toolReply("get_state"),
      toolReply("get_state"),
      toolReply("get_state"),
      toolReply("get_state"),
    );

    await runAgentTurn({
      transcript: "loop",
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    expect((client.create as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("records per-leg timings so the latency budget is measured, not guessed", async () => {
    const result = await runAgentTurn({
      transcript: "what do I owe?",
      context: CONTEXT,
      client: creator(toolReply("get_state"), textReply("Done.")),
      tools: [echoTool],
    });

    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.turns.length).toBe(2);
  });
});
