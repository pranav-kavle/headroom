// The agent turn loop — design doc §3, §7, §9.
//
// Hand-written rather than the SDK's Tool Runner, deliberately: this loop is
// only ever two turns (pick a tool, phrase the result), and owning it directly
// gives exact control over per-leg timing, citation collection, and the
// tier-policy gate that §8 will need. The tool *definitions* stay plain JSON
// Schema either way, so the Voice Agent portability argument is unaffected.

import { engineTools, type EngineContext, type EngineTool } from "@headroom/engine-mcp";
import { buildTurnParams } from "./agent";

// A turn is: model picks a tool -> engine answers -> model phrases it. Anything
// beyond a couple of extra hops is a loop, not a conversation.
const MAX_TURNS = 5;

const REFUSAL_TEXT = "I can't help with that one.";

export interface Citation {
  artifactId: string;
  quote: string;
}

export interface TurnTiming {
  index: number;
  modelMs: number;
  toolMs: number;
}

export interface AgentTurnResult {
  text: string;
  citations: Citation[];
  refused: boolean;
  timings: { totalMs: number; turns: TurnTiming[] };
}

// Structural, so tests don't have to construct real SDK responses and this file
// doesn't hard-depend on SDK types that move between versions.
interface ModelContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}
interface ModelResponse {
  stop_reason?: string;
  content: ModelContentBlock[];
}
export interface MessageCreator {
  create(params: Record<string, unknown>): Promise<ModelResponse>;
}

function textOf(content: ModelContentBlock[]): string {
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join(" ")
    .trim();
}

// Provenance is read off the tool result, never off the model's prose — core
// rule 2. Anything carrying an artifact id and a quote is citable evidence.
function collectCitations(result: unknown, into: Citation[]): void {
  const rows = (result as { openCommitments?: unknown })?.openCommitments;
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const { sourceArtifactId, quote } = (row ?? {}) as Record<string, unknown>;
    if (typeof sourceArtifactId === "string" && typeof quote === "string") {
      into.push({ artifactId: sourceArtifactId, quote });
    }
  }
}

export async function runAgentTurn(input: {
  transcript: string;
  context: EngineContext;
  client: MessageCreator;
  tools?: EngineTool[];
}): Promise<AgentTurnResult> {
  const tools = input.tools ?? engineTools();
  const base = buildTurnParams({ transcript: input.transcript, tools });
  const messages: unknown[] = [...base.messages];
  const citations: Citation[] = [];
  const turns: TurnTiming[] = [];
  const startedAt = Date.now();

  for (let index = 0; index < MAX_TURNS; index++) {
    const modelStart = Date.now();
    const response = await input.client.create({ ...base, messages });
    const modelMs = Date.now() - modelStart;

    // Check before reading content: on a refusal `content` can be empty, and
    // indexing into it would throw rather than surface the refusal.
    if (response.stop_reason === "refusal") {
      turns.push({ index, modelMs, toolMs: 0 });
      return {
        text: REFUSAL_TEXT,
        citations,
        refused: true,
        timings: { totalMs: Date.now() - startedAt, turns },
      };
    }

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      turns.push({ index, modelMs, toolMs: 0 });
      return {
        text: textOf(response.content),
        citations,
        refused: false,
        timings: { totalMs: Date.now() - startedAt, turns },
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolStart = Date.now();
    const results = [];
    for (const call of toolUses) {
      const tool = tools.find((t) => t.name === call.name);
      try {
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);
        const output = await tool.handler(call.input ?? {}, input.context);
        collectCitations(output, citations);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(output),
        });
      } catch (error) {
        // Hand the failure back so the model can recover or say so, rather than
        // dropping the turn — the user is mid-conversation.
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: error instanceof Error ? error.message : String(error),
          is_error: true,
        });
      }
    }
    turns.push({ index, modelMs, toolMs: Date.now() - toolStart });
    messages.push({ role: "user", content: results });
  }

  return {
    text: "I got stuck working that out.",
    citations,
    refused: false,
    timings: { totalMs: Date.now() - startedAt, turns },
  };
}
