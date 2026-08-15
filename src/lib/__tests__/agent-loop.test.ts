import { beforeEach, describe, expect, it, vi } from "vitest";
import { engineTools, type EngineContext, type EngineTool } from "@headroom/engine-mcp";
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

  // Slack has no extraction yet, so its messages never appear in
  // openCommitments — they come back from check_slack as recentMessages. Read
  // one shape and not the other and a Slack answer is spoken with no evidence
  // beside it at all, which is exactly what core rule 2 forbids.
  it("collects citations from a source whose artifacts are not commitments", async () => {
    const slackTool: EngineTool = {
      name: "check_slack",
      description: "test",
      inputSchema: { type: "object" },
      handler: async () => ({
        channelsScanned: 1,
        messagesSynced: 1,
        recentMessages: [
          {
            artifactId: "art_1",
            author: "Priya Raman",
            occurredAt: "2026-08-15T04:12:00.000Z",
            quote: "can you get me the deck by Thursday",
            url: "https://headroom-dev.slack.com/archives/C1/p1",
          },
        ],
      }),
    };

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "anything in slack?" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(toolReply("check_slack"), textReply("Priya asked for the deck.")),
      tools: [slackTool],
    });

    expect(result.citations).toEqual([
      { artifactId: "art_1", quote: "can you get me the deck by Thursday" },
    ]);
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

  // Hitting the turn ceiling used to throw away whatever the model had
  // actually said and substitute "I got stuck" — the user heard a failure
  // even when a perfectly good answer had been produced along the way.
  it("speaks the last thing the model said rather than discarding it at the turn ceiling", async () => {
    const client = creator(
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_state", input: {} }] },
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "You owe Maya the deck." },
          { type: "tool_use", id: "t2", name: "get_state", input: {} },
        ],
      },
      toolReply("get_state"),
      toolReply("get_state"),
      toolReply("get_state"),
    );

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "loop" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client,
      tools: [echoTool],
    });

    expect(result.text).toBe("You owe Maya the deck.");
  });

  it("says so plainly when the ceiling is hit with nothing said at all", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "loop" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(
        toolReply("get_state"),
        toolReply("get_state"),
        toolReply("get_state"),
        toolReply("get_state"),
        toolReply("get_state"),
      ),
      tools: [echoTool],
    });

    expect(result.text).toMatch(/stuck/i);
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

    // Provenance belongs to the claim it backs. Once the claim is gone, the
    // spoken text is our own fallback — rendering evidence beside it would put
    // citations under a sentence that claims nothing.
    it("takes the citations away with the claim they backed", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("get_state"), textReply("You have 9 things open.")),
        tools: [{ ...echoTool, aboutUser: true }],
      });

      expect(result.text).toBe(
        "Sorry — I don't want to give you a number I can't back up. Let me check that again.",
      );
      expect(result.citations).toEqual([]);
    });

    // A flagged violation is telemetry, not a veto — the spelled-number check
    // is too noisy to silence the assistant with.
    it("records a flagged violation without withholding the reply", async () => {
      const result = await runAgentTurn({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: PRINCIPAL,
        context: CONTEXT,
        client: creator(toolReply("get_state"), textReply("You have four things open.")),
        tools: [{ ...echoTool, aboutUser: true }],
      });

      // Still spoken, and recorded — this documents the current limit rather
      // than hiding it: a fabricated count spelled as a word gets through.
      expect(result.text).toBe("You have four things open.");
      expect(result.violations.map((v) => v.severity)).toEqual(["flagged"]);
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

// §8's "one tap". Before this existed, a Tier 2 call was refused and the
// refusal was the end of it — the user could say "go for it" and nothing
// could ever run, because approval had nowhere to be recorded.
describe("Tier 2 approval", () => {
  let posted: string[];
  let tier2Tool: EngineTool;

  beforeEach(() => {
    posted = [];
    tier2Tool = {
      name: "comment_on_pr",
      description: "test",
      inputSchema: { type: "object" },
      tier: "tier_2",
      handler: async (input) => {
        posted.push(String(input.body));
        return { commentUrl: "https://github.com/acme/repo/pull/82#issuecomment-1" };
      },
    };
  });

  it("refuses and records an offer the first time, without running the handler", async () => {
    const proposals: unknown[] = [];

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "comment on the PR" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        resolveApproval: async (call) => {
          proposals.push(call);
          return { approved: false };
        },
      },
      client: creator(toolReply("comment_on_pr", { body: "demo successful" }), textReply("Want me to?")),
      tools: [tier2Tool],
    });

    expect(posted).toEqual([]);
    expect(proposals).toHaveLength(1);
    expect(result.blocked).toEqual([
      { tool: "comment_on_pr", tier: "tier_2", policy: "needs_approval" },
    ]);
    expect(result.executed).toEqual([]);
  });

  // The double send. A duplicate request left an unconsumed offer behind, the
  // user's next words matched it, and the handler ran a second time — while the
  // model, never told the first send had worked, apologised for a failure that
  // had not happened. A completed call is answered as completed, and the
  // handler is not reached at all.
  it("does not run a handler for a call that already completed", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "alright, thank you" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        findCompletedAction: async () => ({
          ranAt: "2026-08-15T09:30:00.000Z",
          externalRef: "https://slack.com/archives/C1/p1",
        }),
        // Would approve if it were ever asked — the completion check runs
        // first, so it isn't.
        resolveApproval: async () => ({ approved: true, actionId: "action-1" }),
      },
      client: creator(toolReply("comment_on_pr", { body: "demo successful" }), textReply("Already done.")),
      tools: [tier2Tool],
    });

    expect(posted).toEqual([]);
    expect(result.executed).toEqual([]);
    // Not blocked either: nothing was refused, and reporting it as a refusal is
    // what made the agent apologise for a send that had succeeded.
    expect(result.blocked).toEqual([]);
  });

  it("runs the handler once the same call comes back approved", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "yeah, go for it" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        resolveApproval: async () => ({ approved: true, actionId: "action-1" }),
      },
      client: creator(toolReply("comment_on_pr", { body: "demo successful" }), textReply("Posted.")),
      tools: [tier2Tool],
    });

    expect(posted).toEqual(["demo successful"]);
    expect(result.blocked).toEqual([]);
    expect(result.executed).toEqual([
      { tool: "comment_on_pr", tier: "tier_2", actionId: "action-1" },
    ]);
  });

  it("marks the action executed only after the handler returns", async () => {
    const order: string[] = [];

    await runAgentTurn({
      messages: [{ role: "user", content: "go" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        resolveApproval: async () => ({ approved: true, actionId: "action-1" }),
        recordActionExecuted: async () => {
          order.push("recorded");
        },
      },
      client: creator(toolReply("comment_on_pr", { body: "x" }), textReply("Posted.")),
      tools: [
        {
          ...tier2Tool,
          handler: async () => {
            order.push("posted");
            return { commentUrl: "u" };
          },
        },
      ],
    });

    expect(order).toEqual(["posted", "recorded"]);
  });

  it("marks the action failed when GitHub rejects it, rather than executed", async () => {
    const failed: string[] = [];

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "go" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        resolveApproval: async () => ({ approved: true, actionId: "action-1" }),
        recordActionExecuted: async () => {
          throw new Error("should not be called");
        },
        recordActionFailed: async (id) => {
          failed.push(id);
        },
      },
      client: creator(toolReply("comment_on_pr", {}), textReply("That didn't work.")),
      tools: [{ ...tier2Tool, handler: async () => Promise.reject(new Error("422 unprocessable")) }],
      });

    expect(failed).toEqual(["action-1"]);
    expect(result.executed).toEqual([]);
  });

  // Tier 3 and 4 are forbidden outright — no offer, no approval, ever.
  it("never offers a forbidden action an approval path", async () => {
    let asked = false;

    const result = await runAgentTurn({
      messages: [{ role: "user", content: "buy it" }],
      principal: PRINCIPAL,
      context: {
        ...CONTEXT,
        resolveApproval: async () => {
          asked = true;
          return { approved: true, actionId: "action-1" };
        },
      },
      client: creator(toolReply("buy_thing", {}), textReply("I can't do that.")),
      tools: [{ ...tier2Tool, name: "buy_thing", tier: "tier_3" }],
    });

    expect(asked).toBe(false);
    expect(posted).toEqual([]);
    expect(result.blocked[0].policy).toBe("forbidden");
  });

  // The gate is tool-agnostic, so Slack's send rides the same path as
  // GitHub's. Proved with the real tool rather than a stand-in, because
  // "it should work too" is exactly the assumption worth checking.
  it("holds and then releases the real send_slack_message tool", async () => {
    const sends: Array<Record<string, unknown>> = [];
    const slackSend = engineTools().find((t) => t.name === "send_slack_message");
    if (!slackSend) throw new Error("send_slack_message is not registered");

    const slackContext: EngineContext = {
      ...CONTEXT,
      slackCredentials: { accessToken: "xoxp-test", slackUserId: "U1" },
      fetchImpl: (async (url: string | URL, init?: RequestInit) => {
        // Only the send itself is recorded — the follow-up team.info lookup
        // that builds the permalink is not the thing under test.
        if (String(url).includes("chat.postMessage")) {
          // Slack's Web API takes form encoding, not JSON.
          sends.push(Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))));
        }
        return new Response(
          JSON.stringify({ ok: true, ts: "1723.45", channel: "C1", team: { domain: "acme" } }),
        );
      }) as typeof fetch,
    };

    const held = await runAgentTurn({
      messages: [{ role: "user", content: "tell the team it shipped" }],
      principal: PRINCIPAL,
      context: { ...slackContext, resolveApproval: async () => ({ approved: false }) },
      client: creator(
        toolReply("send_slack_message", { channel: "C1", text: "it shipped" }),
        textReply("Want me to send that?"),
      ),
      tools: [slackSend],
    });

    expect(sends).toEqual([]);
    expect(held.blocked[0]).toEqual({
      tool: "send_slack_message",
      tier: "tier_2",
      policy: "needs_approval",
    });

    const released = await runAgentTurn({
      messages: [{ role: "user", content: "yes, send it" }],
      principal: PRINCIPAL,
      context: {
        ...slackContext,
        resolveApproval: async () => ({ approved: true, actionId: "action-9" }),
      },
      client: creator(
        toolReply("send_slack_message", { channel: "C1", text: "it shipped" }),
        textReply("Sent."),
      ),
      tools: [slackSend],
    });

    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ channel: "C1", text: "it shipped" });
    expect(released.executed).toEqual([
      { tool: "send_slack_message", tier: "tier_2", actionId: "action-9" },
    ]);
  });


  // Without a resolver wired in, the old behaviour must hold exactly.
  it("blocks as before when no approval path is configured", async () => {
    const result = await runAgentTurn({
      messages: [{ role: "user", content: "comment on the PR" }],
      principal: PRINCIPAL,
      context: CONTEXT,
      client: creator(toolReply("comment_on_pr", { body: "x" }), textReply("Want me to?")),
      tools: [tier2Tool],
    });

    expect(posted).toEqual([]);
    expect(result.blocked).toHaveLength(1);
  });
});
