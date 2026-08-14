import { describe, expect, it } from "vitest";
import { engineTools } from "@headroom/engine-mcp";
import { buildTurnParams, resolveAnthropicApiKey, toAnthropicTools, POLICY_PROMPT } from "../agent";
import { ASSISTANT_NAME } from "../assistant";

const NOW = new Date("2026-08-13T14:00:00Z");

const PRINCIPAL = {
  displayName: "Priya Raman",
  role: "product counsel",
  timezone: "America/Chicago",
};

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
  const params = () =>
    buildTurnParams({
      messages: [{ role: "user", content: "I owe Maya the deck Thursday" }],
      principal: PRINCIPAL,
      now: NOW,
    });

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

  // 2026-08-13 spec §4. The breakpoint sits on block one, which is identical
  // for every user — so the cached prefix is shared across all of them rather
  // than rebuilt per user. Block two is the principal, and must stay outside it.
  it("caches the stable prefix — policy prompt and tool schemas — and nothing user-specific", () => {
    const system = params().system;

    expect(system).toHaveLength(2);
    expect(system[0].text).toBe(POLICY_PROMPT);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[1].cache_control).toBeUndefined();
  });

  it("keeps the cached block byte-identical across users, and varies only the principal", () => {
    const mine = params();
    const theirs = buildTurnParams({
      messages: [{ role: "user", content: "I owe Maya the deck Thursday" }],
      principal: { displayName: "Sam Okafor", role: "staff engineer", timezone: "Europe/Berlin" },
      now: NOW,
    });

    expect(theirs.system[0].text).toBe(mine.system[0].text);
    expect(theirs.system[1].text).not.toBe(mine.system[1].text);
  });

  it("puts the principal — name, role, and resolved dates — in the second block", () => {
    const [, principalBlock] = params().system;

    expect(principalBlock.text).toContain("Priya Raman");
    expect(principalBlock.text).toContain("product counsel");
    expect(principalBlock.text).toContain("2026-08-13");
  });

  // Spec §5: the history was already arriving on every request and being
  // thrown away, so "and the other one?" had nothing to refer to.
  it("passes the whole conversation through, not just the latest utterance", () => {
    const { messages } = buildTurnParams({
      messages: [
        { role: "user", content: "what do I owe Maya?" },
        { role: "assistant", content: "Nothing on file." },
        { role: "user", content: "and the other one?" },
      ],
      principal: PRINCIPAL,
      now: NOW,
    });

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toContain("what do I owe Maya?");
    expect(messages[2].content).toContain("and the other one?");
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

describe("POLICY_PROMPT", () => {
  // Spec §4: with an empty graph the only honest behaviours are capture and
  // read-back. The prompt has to forbid the rest rather than leave it to chance.
  it("forbids the model from computing dates, counts, or scores", () => {
    expect(POLICY_PROMPT).toMatch(/never (compute|calculate)/i);
  });

  it("requires a tool call before any claim about the user's commitments", () => {
    expect(POLICY_PROMPT).toMatch(/get_state/);
  });

  it("tells the model to quote the user rather than paraphrase, for provenance", () => {
    expect(POLICY_PROMPT).toMatch(/quote/i);
  });

  // Bug 6: the prompt had no tone guidance at all, and the default read as
  // flat/robotic rather than the warm, energetic assistant this is meant to be.
  it("asks for a warm, energetic tone rather than leaving delivery unspecified", () => {
    expect(POLICY_PROMPT).toMatch(/warm|energetic|upbeat/i);
  });

  // Core rule 2 scopes provenance to claims about the user's life — it was
  // never a ban on conversation in general. The old prompt's "you have
  // exactly two jobs" framing over-applied it, making ordinary chat feel
  // broken. The constraints stay; only the scope changes.
  it("allows general conversation rather than limiting the model to two jobs", () => {
    expect(POLICY_PROMPT).not.toMatch(/exactly two jobs/i);
    expect(POLICY_PROMPT).toMatch(/anything|any topic|general conversation/i);
  });

  // §16: live third-party lookups are not claims about the user's life, so
  // the commitment constraints must not swallow them. That rule is policy and
  // belongs here. *Which* tool to call for what is routing, belongs in the
  // descriptions, and used to be duplicated here — see
  // tests/architecture/prompt-tool-enumeration.test.ts for why it left.
  it("exempts live world data from the commitment constraints without naming a single tool", () => {
    expect(POLICY_PROMPT).toMatch(/live, real-world information/i);
    expect(POLICY_PROMPT).toMatch(/do not apply/i);
    expect(POLICY_PROMPT).not.toMatch(/get_weather|get_events|get_flight_status/);
  });

  // `6f30683` gave the assistant a name and put it in one constant so the copy
  // and the prompt could not drift — and the prompt kept saying "Headroom".
  it("introduces itself by the assistant's one canonical name", () => {
    expect(POLICY_PROMPT).toContain(ASSISTANT_NAME);
    expect(POLICY_PROMPT).not.toMatch(/^You are Headroom/m);
  });

  // 2026-08-13 spec §4.3. The delimiter around the user's typed text only
  // means something if the rule that reads it lives in this block — the one
  // with no user-controlled input in it.
  it("states that the principal block is data, never instruction", () => {
    expect(POLICY_PROMPT).toMatch(/<principal>/);
    expect(POLICY_PROMPT).toMatch(/never instruction|not.*instruction|never an instruction/i);
  });

  it("lets the role shape vocabulary but never imply a commitment", () => {
    expect(POLICY_PROMPT).toMatch(/vocabulary/i);
    expect(POLICY_PROMPT).toMatch(/role is not evidence|may not infer a commitment/i);
  });

  // §5. History exists now, so the rule it could previously not break has to
  // be stated: it is for reference resolution, never for facts.
  it("scopes the conversation history to reference resolution, not fact", () => {
    expect(POLICY_PROMPT).toMatch(/never a source of fact/i);
    expect(POLICY_PROMPT).toMatch(/call `get_state` again in this turn/i);
  });

  // The engine hands over ISO dates and the prompt forbids transforming what
  // the engine returns — so without this the correct behaviour was to read
  // "2026-08-13" out loud.
  it("says how to speak a date, since every date it receives is machine-shaped", () => {
    expect(POLICY_PROMPT).toMatch(/heard, not read/i);
    expect(POLICY_PROMPT).toMatch(/ISO dates/);
    expect(POLICY_PROMPT).toMatch(/artifact id is never spoken/i);
  });
});
