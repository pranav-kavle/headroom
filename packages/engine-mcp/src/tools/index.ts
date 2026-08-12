// The engine's tool registry — design doc §7's tools, described in plain JSON
// Schema with no LLM-SDK coupling.
//
// That's deliberate and load-bearing: the same definitions feed the Anthropic
// Tool Runner today and could feed Deepgram Voice Agent's function calling at
// v1.5 through a small adapter, rather than needing a rewrite per tool. Port
// rule 5 applied to the model layer.

import { buildState, type EngineState, type StateCommitmentInput } from "./state";
import {
  getActionPolicy,
  type ActionPolicy,
  type ActionTier,
  type ActionPolicyOptions,
} from "./action-policy";

// Minimal JSON Schema shape — enough to describe these tools without pulling in
// a schema library the engine would then be coupled to.
export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

// Everything a handler is allowed to reach. The graph accessor is injected so
// Prisma stays inside @headroom/graph (port rule 6) and so `now` stays the
// engine's to decide, never the model's.
export interface EngineContext {
  userId: string;
  now: Date;
  listCommitments: (userId: string) => Promise<StateCommitmentInput[]>;
  tier1Unattended?: boolean;
}

export interface EngineTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (input: Record<string, unknown>, context: EngineContext) => Promise<unknown>;
}

const KNOWN_TIERS: ActionTier[] = ["tier_1", "tier_2", "tier_3", "tier_4"];

function isActionTier(value: unknown): value is ActionTier {
  return typeof value === "string" && (KNOWN_TIERS as string[]).includes(value);
}

export function engineTools(): EngineTool[] {
  return [
    {
      name: "get_state",
      description:
        "The user's current commitment state: today's date, their open commitments, and counts by direction. Call this before making any statement about what the user owes or is owed. Every date and count in the result is computed here — never calculate one yourself.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      // Note the ignored input: the user is taken from the request context, not
      // from anything the model says, so no prompt can widen the query.
      handler: async (_input, context): Promise<EngineState> =>
        buildState({
          now: context.now,
          commitments: await context.listCommitments(context.userId),
        }),
    },
    {
      name: "get_action_policy",
      description:
        "Whether an action of a given tier may execute: 'allowed', 'needs_approval', or 'forbidden'. Call this before proposing any action. You do not decide your own autonomy — this does.",
      inputSchema: {
        type: "object",
        properties: {
          tier: { type: "string", enum: KNOWN_TIERS, description: "The action's tier." },
          kind: { type: "string", description: "The action kind, e.g. 'draft_reply'." },
        },
        required: ["tier"],
        additionalProperties: false,
      },
      handler: async (input, context): Promise<{ policy: ActionPolicy }> => {
        if (!isActionTier(input.tier)) {
          throw new Error(`Unknown action tier: ${String(input.tier)}`);
        }
        const options: ActionPolicyOptions = { tier1Unattended: context.tier1Unattended };
        return { policy: getActionPolicy(input.tier, options) };
      },
    },
  ];
}

export { buildState, getActionPolicy };
export type { EngineState, StateCommitmentInput, ActionPolicy, ActionTier };
