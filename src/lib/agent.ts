// The agent turn — design doc §3 (core rules), §7 (the engine), §9 (voice), and
// the voice-agent-harness spec §2/§4/§5.
//
// The harness is the Anthropic SDK's Tool Runner over the engine's tools, not
// the Claude Agent SDK: this agent's whole capability surface is engine
// functions over Postgres, answered inside one voice turn. Nothing here needs a
// filesystem, a shell, or web search.

import { engineTools, type EngineTool } from "@headroom/engine-mcp";
import type { EnvSource } from "./env";

export const AGENT_MODEL = "claude-opus-5";

// Spec §7. The SDK would pick ANTHROPIC_API_KEY up from the environment on its
// own, but silently — a missing key then surfaces as a 401 mid-turn instead of
// a named failure at wiring time.
export function resolveAnthropicApiKey(env: EnvSource = process.env): string {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — the agent cannot start.");
  }
  return apiKey;
}

// Spec §5. Two round trips per turn (choose a tool, then phrase the answer), so
// the ceiling has to cover thinking on both — but stay small enough that a
// runaway turn can't stall the voice loop.
const MAX_TOKENS = 4096;

// Spec §4. Core rule 2 scopes provenance to claims about the user's life —
// it was never a mandate to refuse ordinary conversation. Talk about
// anything; the hard constraints below apply specifically when the topic is
// the user's own commitments, where an empty graph leaves capture and
// read-back as the only two honest things to say.
export const SYSTEM_PROMPT = `You are Headroom — a voice assistant who can talk about anything, and who also happens to be the user's chief of staff, tracking what they've promised and to whom.

You speak out loud. Keep replies to one or two short sentences — they are heard, not read.

Have a normal conversation. Answer questions, chat, help think something through — the same way any capable voice assistant would, on any topic.

## When the topic is the user's own commitments

- **Capture.** When the user states a commitment, confirm you have it, quoting their own words back. Their transcript is already stored; you are acknowledging it, not saving it.
- **Read back.** Answer questions about their commitments using \`get_state\` — never from memory or from earlier in the conversation.

## Hard constraints — for commitments only, not for conversation in general

- **Never compute anything about a commitment.** No dates, no counts, no durations, no scores, no rankings. Every number and every date must come from a tool result. If you need today's date, call \`get_state\` — do not calculate it, and do not resolve "Thursday" or "next week" into a date yourself. You may repeat the user's own words for a day ("Thursday") because that is quoting, not arithmetic.
- **Call \`get_state\` before any statement about what the user owes or is owed.**
- **Quote, don't paraphrase.** When you refer to a commitment, use the wording in the tool result.
- **Say when you don't know.** If \`get_state\` returns nothing, say you have nothing on file. Do not guess, and do not soften it into something that sounds like data.
- **No comparisons yet.** You cannot say "your third promise this week", "the most at risk", or anything else requiring a count or a ranking the engine did not hand you.
- **You do not decide what you are allowed to do.** Call \`get_action_policy\` before proposing any action, and respect the verdict.`;

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: EngineTool["inputSchema"];
}

// The engine describes its tools in plain JSON Schema (engine-mcp/tools), so
// this adapter is the only Anthropic-specific shim. Swapping the harness — e.g.
// to Deepgram Voice Agent function calling at v1.5 — replaces this function,
// not the tools.
export function toAnthropicTools(tools: EngineTool[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

export interface TurnParams {
  model: string;
  max_tokens: number;
  thinking: { type: "adaptive" };
  output_config: { effort: "low" };
  system: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }>;
  tools: AnthropicTool[];
  messages: Array<{ role: "user"; content: string }>;
}

export function buildTurnParams(input: {
  transcript: string;
  tools?: EngineTool[];
}): TurnParams {
  return {
    model: AGENT_MODEL,
    max_tokens: MAX_TOKENS,
    // Spec §5: thinking stays on deliberately. With it disabled, Opus 5 can
    // write a tool call into its visible text instead of emitting one — the
    // turn succeeds and the engine is silently never consulted.
    thinking: { type: "adaptive" },
    // ...so `effort` carries the latency budget instead. Low and medium are
    // unusually strong on Opus 5, and rule 1 leaves this model no reasoning to
    // do beyond picking a tool and wording the result.
    output_config: { effort: "low" },
    // Cached prefix. Opus 5's minimum cacheable prefix is 512 tokens, which the
    // prompt plus tool schemas clear comfortably.
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    // Defaults to the engine's full registry — a turn with no tools could only
    // answer from the model's own memory, which core rule 2 forbids outright.
    tools: toAnthropicTools(input.tools ?? engineTools()),
    // Volatile content last, so a new transcript never invalidates the prefix.
    messages: [{ role: "user", content: input.transcript }],
  };
}
