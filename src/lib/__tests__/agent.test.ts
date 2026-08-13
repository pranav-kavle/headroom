import { describe, expect, it } from "vitest";
import { engineTools } from "@headroom/engine-mcp";
import { buildTurnParams, resolveAnthropicApiKey, toAnthropicTools, SYSTEM_PROMPT } from "../agent";

// Spec §7: a missing key fails loudly, naming the variable — never a silent
// fallback that would leave the agent running against nothing.
describe("resolveAnthropicApiKey", () => {
  it("returns the key when it is set", () => {
    expect(resolveAnthropicApiKey({ ANTHROPIC_API_KEY: "sk-ant-x" })).toBe("sk-ant-x");
  });

  it("throws naming ANTHROPIC_API_KEY when it is missing", () => {
    expect(() => resolveAnthropicApiKey({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("toAnthropicTools", () => {
  it("maps every engine tool to Anthropic's tool shape", () => {
    const tools = toAnthropicTools(engineTools());

    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_action_policy",
      "get_events",
      "get_flight_status",
      "get_state",
      "get_weather",
    ]);
    for (const tool of tools) {
      expect(tool.input_schema.type).toBe("object");
      expect(typeof tool.description).toBe("string");
    }
  });
});

describe("buildTurnParams", () => {
  const params = () => buildTurnParams({ transcript: "I owe Maya the deck Thursday" });

  it("runs on Opus 5", () => {
    expect(params().model).toBe("claude-opus-5");
  });

  // Spec §5: disabling thinking on Opus 5 can make the model write a tool call
  // into its visible text instead of calling the tool — the turn succeeds, the
  // engine is never consulted, and nothing errors. That is a silent core-rule-1
  // violation, so thinking stays on and `effort` is the latency knob instead.
  it("leaves thinking enabled rather than trading correctness for latency", () => {
    expect(params().thinking).toEqual({ type: "adaptive" });
  });

  it("uses low effort as the latency lever", () => {
    expect(params().output_config?.effort).toBe("low");
  });

  it("caches the stable prefix — system prompt and tool schemas", () => {
    const system = params().system;

    expect(Array.isArray(system)).toBe(true);
    expect(system[system.length - 1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("puts the per-turn transcript after the cached prefix, as the user message", () => {
    const { messages } = params();

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("I owe Maya the deck Thursday");
  });

  it("passes the engine tools through to the model", () => {
    expect(params().tools.map((t) => t.name).sort()).toEqual([
      "get_action_policy",
      "get_events",
      "get_flight_status",
      "get_state",
      "get_weather",
    ]);
  });

  it("sets a max_tokens ceiling that leaves room for thinking", () => {
    expect(params().max_tokens).toBeGreaterThanOrEqual(2048);
  });
});

describe("SYSTEM_PROMPT", () => {
  // Spec §4: with an empty graph the only honest behaviours are capture and
  // read-back. The prompt has to forbid the rest rather than leave it to chance.
  it("forbids the model from computing dates, counts, or scores", () => {
    expect(SYSTEM_PROMPT).toMatch(/never (compute|calculate)/i);
  });

  it("requires a tool call before any claim about the user's commitments", () => {
    expect(SYSTEM_PROMPT).toMatch(/get_state/);
  });

  it("tells the model to quote the user rather than paraphrase, for provenance", () => {
    expect(SYSTEM_PROMPT).toMatch(/quote/i);
  });

  // Bug 6: the prompt had no tone guidance at all, and the default read as
  // flat/robotic rather than the warm, energetic assistant this is meant to be.
  it("asks for a warm, energetic tone rather than leaving delivery unspecified", () => {
    expect(SYSTEM_PROMPT).toMatch(/warm|energetic|upbeat/i);
  });

  // Core rule 2 scopes provenance to claims about the user's life — it was
  // never a ban on conversation in general. The old prompt's "you have
  // exactly two jobs" framing over-applied it, making ordinary chat feel
  // broken. The constraints stay; only the scope changes.
  it("allows general conversation rather than limiting the model to two jobs", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/exactly two jobs/i);
    expect(SYSTEM_PROMPT).toMatch(/anything|any topic|general conversation/i);
  });

  // §16: these three are live third-party lookups, not claims about the
  // user's life — the prompt should point the model at them without folding
  // them into the commitments hard constraints above.
  it("names the live lookup tools so the model knows to use them instead of guessing", () => {
    expect(SYSTEM_PROMPT).toMatch(/get_weather/);
    expect(SYSTEM_PROMPT).toMatch(/get_events/);
    expect(SYSTEM_PROMPT).toMatch(/get_flight_status/);
  });
});
