// The agent turn loop — design doc §3, §7, §9.
//
// Hand-written rather than the SDK's Tool Runner, deliberately: this loop is
// only ever two turns (pick a tool, phrase the result), and owning it directly
// gives exact control over per-leg timing, citation collection, and the
// tier-policy gate that §8 will need. The tool *definitions* stay plain JSON
// Schema either way, so the Voice Agent portability argument is unaffected.

import { randomUUID } from "node:crypto";
import {
  engineTools,
  getActionPolicy,
  type ActionPolicy,
  type ActionTier,
  type EngineContext,
  type EngineTool,
} from "@headroom/engine-mcp";
import { buildTurnParams } from "./agent";
import { verifySpokenText, type Violation } from "./verify-output";
import type { Principal } from "./principal";
import type { TurnMessage } from "./openai-compat";

// A turn is: model picks a tool -> engine answers -> model phrases it. Anything
// beyond a couple of extra hops is a loop, not a conversation.
const MAX_TURNS = 5;

const REFUSAL_TEXT = "I can't help with that one.";

// Bug 9/10: nothing bounded how long a single model call could take, so a
// hung or failed Anthropic request stalled the whole voice turn with no
// user-facing signal at all — the user just heard silence forever.
const MODEL_CALL_TIMEOUT_MS = 15_000;
const MODEL_CALL_FAILURE_TEXT = "I'm having trouble reaching that right now — try again in a moment.";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Model call timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface Citation {
  artifactId: string;
  quote: string;
}

export interface TurnTiming {
  index: number;
  modelMs: number;
  toolMs: number;
}

export interface BlockedCall {
  tool: string;
  tier: ActionTier;
  policy: ActionPolicy;
}

export interface AgentTurnResult {
  // 2026-08-13 spec §2. Everything below belongs to *this* turn and can be
  // found again by this id — which is what citations, the policy record, and
  // eventually an AgentRun row all need and none of them had.
  turnId: string;
  text: string;
  citations: Citation[];
  toolCalls: string[];
  blocked: BlockedCall[];
  violations: Violation[];
  refused: boolean;
  timings: { totalMs: number; turns: TurnTiming[] };
}

// §4. Spoken instead of a reply that failed verification. It says what
// happened rather than inventing a smoother excuse, because the alternative —
// quietly speaking an unsourced figure — is the exact failure the check exists
// to catch.
const UNVERIFIED_TEXT =
  "Sorry — I don't want to give you a number I can't back up. Let me check that again.";

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
//
// Two shapes, because a source without extraction has no commitments to carry
// its evidence: get_state's `openCommitments` name the artifact
// `sourceArtifactId`, while check_slack's `recentMessages` are artifacts
// themselves and name it `artifactId`. Both are an id plus the words that back
// the claim; reading only the first would leave every Slack answer uncited.
const CITABLE_KEYS: Array<{ list: string; id: string }> = [
  { list: "openCommitments", id: "sourceArtifactId" },
  { list: "recentMessages", id: "artifactId" },
];

function collectCitations(result: unknown, into: Citation[]): void {
  for (const { list, id } of CITABLE_KEYS) {
    const rows = (result as Record<string, unknown> | null)?.[list];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const record = (row ?? {}) as Record<string, unknown>;
      const artifactId = record[id];
      const { quote } = record;
      if (typeof artifactId === "string" && typeof quote === "string") {
        into.push({ artifactId, quote });
      }
    }
  }
}

export async function runAgentTurn(input: {
  // The conversation so far, not just the latest utterance (2026-08-13 spec
  // §5) — the model needs it to resolve "that one", and the policy prompt is
  // what stops it being treated as evidence.
  messages: TurnMessage[];
  principal: Principal;
  context: EngineContext;
  client: MessageCreator;
  tools?: EngineTool[];
}): Promise<AgentTurnResult> {
  const tools = input.tools ?? engineTools();
  const base = buildTurnParams({
    messages: input.messages,
    principal: input.principal,
    // The same instant the engine gets, so the principal block's resolved
    // dates and `get_state`'s `today` can never disagree.
    now: input.context.now,
    tools,
  });
  const messages: unknown[] = [...base.messages];
  const citations: Citation[] = [];
  const turns: TurnTiming[] = [];
  const toolCalls: string[] = [];
  const blocked: BlockedCall[] = [];
  const startedAt = Date.now();
  const turnId = randomUUID();
  let lastText = "";

  // Everything this turn is entitled to have taken a figure from: the resolved
  // dates it was handed, the user's own words, and — appended as they arrive —
  // every tool result. The verifier checks the spoken reply against exactly
  // this and nothing else.
  const evidence: string[] = [
    base.system[1]?.text ?? "",
    ...input.messages.filter((m) => m.role === "user").map((m) => m.content),
  ];
  let aboutUser = false;

  const finish = (text: string, options: { refused?: boolean } = {}): AgentTurnResult => {
    const violations = verifySpokenText({ text, evidence, aboutUser });
    // Only the checks that earn it take the reply away — see ViolationSeverity.
    const withheld = violations.some((v) => v.severity === "withheld");
    return {
      turnId,
      // §4: an unverifiable statement about the user's life is not utterable.
      // The reply is replaced rather than annotated — there is no version of
      // "say it anyway, but flag it" that is compatible with core rule 1.
      text: withheld ? UNVERIFIED_TEXT : text,
      // Citations belong to the claim they back. Once the claim is withheld,
      // the spoken text is our own fallback, and rendering evidence beside it
      // would attach provenance to a sentence that makes no claim at all.
      citations: withheld ? [] : citations,
      toolCalls,
      blocked,
      violations,
      refused: options.refused ?? false,
      timings: { totalMs: Date.now() - startedAt, turns },
    };
  };

  for (let index = 0; index < MAX_TURNS; index++) {
    const modelStart = Date.now();
    let response: ModelResponse;
    try {
      response = await withTimeout(input.client.create({ ...base, messages }), MODEL_CALL_TIMEOUT_MS);
    } catch {
      turns.push({ index, modelMs: Date.now() - modelStart, toolMs: 0 });
      return finish(MODEL_CALL_FAILURE_TEXT);
    }
    const modelMs = Date.now() - modelStart;

    // Check before reading content: on a refusal `content` can be empty, and
    // indexing into it would throw rather than surface the refusal.
    if (response.stop_reason === "refusal") {
      turns.push({ index, modelMs, toolMs: 0 });
      return finish(REFUSAL_TEXT, { refused: true });
    }

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      turns.push({ index, modelMs, toolMs: 0 });
      return finish(textOf(response.content));
    }

    messages.push({ role: "assistant", content: response.content });

    // A tool-calling response can carry prose alongside the call. Keeping it
    // means hitting the turn ceiling below costs the user the *extra* work the
    // model wanted to do, not the answer it already gave.
    const saidSoFar = textOf(response.content);
    if (saidSoFar) lastText = saidSoFar;

    const toolStart = Date.now();
    const results = [];
    for (const call of toolUses) {
      const tool = tools.find((t) => t.name === call.name);
      try {
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);
        toolCalls.push(tool.name);

        // 2026-08-13 spec §3 — the gate, and the only place autonomy is
        // decided. The tier comes off the tool, never off the model, so this
        // cannot be talked around; and it sits before `handler`, so a
        // disallowed action does not run and then get apologised for.
        if (tool.tier) {
          const policy = getActionPolicy(tool.tier, {
            tier1Unattended: input.context.tier1Unattended,
          });
          if (policy !== "allowed") {
            blocked.push({ tool: tool.name, tier: tool.tier, policy });
            results.push({
              type: "tool_result",
              tool_use_id: call.id,
              // Handed back as data rather than an error: the model's job now
              // is to offer, or to say it cannot — not to retry.
              content: JSON.stringify({
                executed: false,
                policy,
                tier: tool.tier,
                explanation:
                  policy === "needs_approval"
                    ? "This action needs the user's approval before it can run. Offer it; do not claim it is done."
                    : "This action cannot be run at all. Say so plainly; do not offer it.",
              }),
            });
            continue;
          }
        }

        if (tool.aboutUser) aboutUser = true;

        const output = await tool.handler(call.input ?? {}, input.context);
        collectCitations(output, citations);
        const serialized = JSON.stringify(output);
        evidence.push(serialized);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: serialized,
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

  // Out of turns. Say what was actually said if anything was — the ceiling is
  // a bound on the model's *work*, not a reason to discard its answer.
  return finish(lastText || "I got stuck working that out.");
}
