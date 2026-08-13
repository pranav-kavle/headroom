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
import { fetchWeather, type WeatherReport } from "./weather";
import { fetchEvents, type EventSummary } from "./events";
import { fetchFlightStatus, type FlightStatus } from "./flights";

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
  // Live third-party lookups (§16) — injected so tests never hit the network,
  // and so the app layer (not the engine) owns key resolution, same as every
  // other credential in this codebase.
  fetchImpl?: typeof fetch;
  ticketmasterApiKey?: string;
  rapidApiKey?: string;
}

export interface EngineTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (input: Record<string, unknown>, context: EngineContext) => Promise<unknown>;
  // Set on tools that hit a live third-party API — the voice loop uses this
  // to know which calls are slow enough to warrant a filler message.
  external?: boolean;
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
    {
      name: "get_weather",
      description:
        "Live current weather conditions for a place — temperature, wind, and sky. A plan-quality signal only, never a diagnosis of anything about the user.",
      inputSchema: {
        type: "object",
        properties: { location: { type: "string", description: "A place name, e.g. 'Chicago'." } },
        required: ["location"],
        additionalProperties: false,
      },
      external: true,
      handler: async (input, context): Promise<WeatherReport> => {
        if (typeof input.location !== "string" || !input.location.trim()) {
          throw new Error("get_weather requires a location.");
        }
        return fetchWeather({ location: input.location, fetchImpl: context.fetchImpl });
      },
    },
    {
      name: "get_events",
      description:
        "Live event listings (concerts, shows, games) near a place, from Ticketmaster. Useful for planning conflicts or suggestions — not a claim about anything the user has committed to.",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "A city name, e.g. 'Chicago'." },
          keyword: { type: "string", description: "Optional search term, e.g. 'jazz' or a team name." },
        },
        required: ["location"],
        additionalProperties: false,
      },
      external: true,
      handler: async (input, context): Promise<{ events: EventSummary[] }> => {
        if (typeof input.location !== "string" || !input.location.trim()) {
          throw new Error("get_events requires a location.");
        }
        const events = await fetchEvents({
          location: input.location,
          keyword: typeof input.keyword === "string" ? input.keyword : undefined,
          apiKey: context.ticketmasterApiKey ?? "",
          fetchImpl: context.fetchImpl,
        });
        return { events };
      },
    },
    {
      name: "get_flight_status",
      description:
        "Live status of a specific flight — scheduled/revised times, airports, and current status — by flight number and date.",
      inputSchema: {
        type: "object",
        properties: {
          flightNumber: { type: "string", description: "e.g. 'UA1' or 'BA249'." },
          date: { type: "string", description: "The flight's departure date, as YYYY-MM-DD." },
        },
        required: ["flightNumber", "date"],
        additionalProperties: false,
      },
      external: true,
      handler: async (input, context): Promise<FlightStatus> => {
        if (typeof input.flightNumber !== "string" || !input.flightNumber.trim()) {
          throw new Error("get_flight_status requires a flightNumber.");
        }
        if (typeof input.date !== "string" || !input.date.trim()) {
          throw new Error("get_flight_status requires a date.");
        }
        return fetchFlightStatus({
          flightNumber: input.flightNumber,
          date: input.date,
          apiKey: context.rapidApiKey ?? "",
          fetchImpl: context.fetchImpl,
        });
      },
    },
  ];
}

export { buildState, getActionPolicy };
export type { EngineState, StateCommitmentInput, ActionPolicy, ActionTier };
export type { WeatherReport, EventSummary, FlightStatus };
