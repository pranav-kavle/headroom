import { describe, expect, it, vi } from "vitest";
import type { EngineContext, EngineTool } from "@headroom/engine-mcp";
import { runAgentTurn, type MessageCreator } from "../agent-loop";

const PRINCIPAL = { displayName: "Priya", role: null, timezone: "America/Chicago" };

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
      messages: [{ role: "user", content: "hello" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(textReply("Nothing on file.")),
      tools: [echoTool],
    });

    expect(result.text).toBe("Nothing on file.");
  });

  it("executes a tool call and feeds the result back for a second turn", async () => {
    const client = creator(toolReply("get_state"), textReply("You owe Maya the deck."));

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "what do I owe?" }],
      principal: PRINCIPAL,
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
      messages: [{ role: "user", content: "what do I owe?" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(toolReply("get_state"), textReply("You owe Maya the deck.")),
      tools: [echoTool],
    });

    expect(result.citations).toEqual([{ artifactId: "a1", quote: "I owe Maya the deck" }]);
  });

  it("surfaces a refusal instead of returning empty text", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "hello" }],
      principal: PRINCIPAL,
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
      messages: [{ role: "user", content: "what do I owe?" }],
      principal: PRINCIPAL,
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
      messages: [{ role: "user", content: "loop" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    expect((client.create as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(5);
  });

  // Bug 9/10: nothing bounded how long a model call could take, so a hung
  // Anthropic request stalled the whole voice turn indefinitely with no
  // user-facing signal at all.
  it("returns a graceful message rather than hanging forever if the model call never resolves", async () => {
    vi.useFakeTimers();
    try {
      const hangingClient: MessageCreator = { create: () => new Promise(() => {}) };

      const resultPromise = runAgentTurn({
        messages: [{ role: "user", content: "hello" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: hangingClient,
        tools: [echoTool],
      });

      await vi.advanceTimersByTimeAsync(60_000);
      const result = await resultPromise;

      expect(result.text).toMatch(/trouble|try again/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a graceful message instead of throwing when the model call itself fails", async () => {
    const failingClient: MessageCreator = {
      create: async () => {
        throw new Error("network blip");
      },
    };

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "hello" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: failingClient,
      tools: [echoTool],
    });

    expect(result.text).toMatch(/trouble|try again/i);
  });

  // 2026-08-13 spec §5/§4. The two things the turn could not previously see:
  // what was already said, and who is saying it.
  it("forwards the whole conversation and the principal to the model", async () => {
    const client = creator(textReply("The deck one."));

    await runAgentTurn({
      messages: [
        { role: "user", content: "what do I owe Maya?" },
        { role: "assistant", content: "Nothing on file." },
        { role: "user", content: "and the other one?" },
      ],
      principal: PRINCIPAL,
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    const params = (client.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(params.messages).toHaveLength(3);
    expect(params.messages[1]).toEqual({ role: "assistant", content: "Nothing on file." });
    expect(params.system[1].text).toContain("Priya");
  });

  // The principal block's dates and get_state's `today` come from the same
  // instant, so they cannot contradict each other mid-turn.
  it("resolves the principal block's dates from the engine's clock", async () => {
    const client = creator(textReply("ok"));

    await runAgentTurn({
      messages: [{ role: "user", content: "what day is it?" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    const params = (client.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(params.system[1].text).toContain("2026-08-12");
  });

  // 2026-08-13 spec (turn identity / policy gate / verifier) §3. Tier is a
  // property of the tool, so the model cannot route around the gate by
  // choosing a gentler tier — it never supplies one.
  describe("the policy gate", () => {
    function gatedTool(tier: "tier_1" | "tier_2" | "tier_3", handler = vi.fn()): EngineTool {
      return {
        name: "send_reply",
        description: "test",
        inputSchema: { type: "object" },
        tier,
        handler: handler as unknown as EngineTool["handler"],
      };
    }

    it("refuses to execute an outward-facing action, and tells the model why", async () => {
      const handler = vi.fn();
      const client = creator(toolReply("send_reply"), textReply("Want me to send it?"));

      const result = await runAgentTurn({
        messages: [{ role: "user", content: "reply to Maya" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client,
        tools: [gatedTool("tier_2", handler)],
      });

      expect(handler).not.toHaveBeenCalled();
      expect(result.blocked).toEqual([{ tool: "send_reply", tier: "tier_2", policy: "needs_approval" }]);

      const handback = (client.create as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0];
      const toolResult = handback.messages[handback.messages.length - 1].content[0];
      expect(toolResult.content).toContain("needs_approval");
    });

    it("refuses money and third-party actions outright", async () => {
      const handler = vi.fn();

      const result = await runAgentTurn({
        messages: [{ role: "user", content: "book the flight" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("send_reply"), textReply("I can't book that.")),
        tools: [gatedTool("tier_3", handler)],
      });

      expect(handler).not.toHaveBeenCalled();
      expect(result.blocked[0].policy).toBe("forbidden");
    });

    // Tier 1 is unattended only once §6's precision bar is met, and the engine
    // owns that switch — not the model, and not this loop.
    it("runs a private, reversible action only when the engine says tier 1 is unattended", async () => {
      const allowed = vi.fn().mockResolvedValue({ ok: true });
      await runAgentTurn({
        messages: [{ role: "user", content: "draft it" }],
        principal: PRINCIPAL,
        context: { ...CONTEXT, tier1Unattended: true },
        client: creator(toolReply("send_reply"), textReply("Drafted.")),
        tools: [gatedTool("tier_1", allowed)],
      });
      expect(allowed).toHaveBeenCalled();

      const withheld = vi.fn();
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "draft it" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("send_reply"), textReply("Want me to?")),
        tools: [gatedTool("tier_1", withheld)],
      });
      expect(withheld).not.toHaveBeenCalled();
      expect(result.blocked[0].policy).toBe("needs_approval");
    });

    it("leaves reads alone — an undeclared tier is not a gate", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("get_state"), textReply("Nothing on file.")),
        tools: [echoTool],
      });

      expect(result.blocked).toEqual([]);
      expect(result.text).toBe("Nothing on file.");
    });
  });

  // §4. The last thing between a fabricated figure and a speaker.
  describe("the output verifier", () => {
    it("does not speak a reply whose figures trace to nothing", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("get_state"), textReply("You have 9 things open this week.")),
        tools: [{ ...echoTool, aboutUser: true }],
      });

      expect(result.text).not.toContain("9");
      expect(result.violations.map((v) => v.kind)).toEqual(["unsourced_number"]);
    });

    it("speaks a reply whose figures come from the tool result", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("get_state"), textReply("Just the 1 — Maya's deck.")),
        tools: [{ ...echoTool, aboutUser: true }],
      });

      expect(result.text).toBe("Just the 1 — Maya's deck.");
      expect(result.violations).toEqual([]);
    });

    // The check is scoped to claims about the user's life, so ordinary
    // conversation is untouched.
    it("leaves an ordinary answer alone when no tool about the user ran", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what's two plus two?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(textReply("That's 4.")),
        tools: [echoTool],
      });

      expect(result.text).toBe("That's 4.");
      expect(result.violations).toEqual([]);
    });
  });

  it("gives every turn an id, so its evidence can be found again", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "hello" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(textReply("Hi.")),
      tools: [echoTool],
    });

    expect(result.turnId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("records per-leg timings so the latency budget is measured, not guessed", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "what do I owe?" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(toolReply("get_state"), textReply("Done.")),
      tools: [echoTool],
    });

    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.turns.length).toBe(2);
  });
});
