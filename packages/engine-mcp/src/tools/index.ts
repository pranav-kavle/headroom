// The engine's tool registry — design doc §7's tools, described in plain JSON
// Schema with no LLM-SDK coupling.
//
// That's deliberate and load-bearing: the same definitions feed the Anthropic
// turn loop today and could feed Deepgram Voice Agent's function calling at
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
import { githubActionTools, type GithubActionCommitment } from "./github-actions";

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
  // The user's IANA zone (2026-08-13 spec §4.2). A calendar day is meaningless
  // without one, and the engine owns every date the model is allowed to say —
  // so it has to own the zone they are resolved in too. Absent means UTC.
  timezone?: string;
  tier1Unattended?: boolean;
  // Live third-party lookups (§16) — injected so tests never hit the network,
  // and so the app layer (not the engine) owns key resolution, same as every
  // other credential in this codebase.
  fetchImpl?: typeof fetch;
  ticketmasterApiKey?: string;
  rapidApiKey?: string;
  // The GitHub write actions' credential and commitment lookup — populated
  // the same way as the API keys above: the app layer resolves them, the
  // engine only ever receives what it was handed.
  githubToken?: string;
  getCommitmentById?: (id: string, userId: string) => Promise<GithubActionCommitment | null>;
}

export interface EngineTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (input: Record<string, unknown>, context: EngineContext) => Promise<unknown>;
  // Set on tools that hit a live third-party API — the voice loop uses this
  // to know which calls are slow enough to warrant a filler message.
  external?: boolean;
  // §8's tier, as a property of the tool rather than an argument the model
  // supplies. Core rule 3 — "the model never chooses its own autonomy tier" —
  // is only true if the tier is declared here, where the model cannot reach
  // it. Undeclared means a read: nothing to gate. The loop refuses to run the
  // handler of anything the policy table does not allow.
  tier?: ActionTier;
  // Set on tools whose results are claims about the user's own life. The
  // output verifier arms its numeral check only when one of these ran, because
  // core rule 2 scopes provenance to exactly that and the prompt permits
  // ordinary conversation on everything else.
  aboutUser?: boolean;
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
      aboutUser: true,
      // Note the ignored input: the user is taken from the request context, not
      // from anything the model says, so no prompt can widen the query.
      handler: async (_input, context): Promise<EngineState> =>
        buildState({
          now: context.now,
          timezone: context.timezone,
          commitments: await context.listCommitments(context.userId),
        }),
    },
    {
      name: "get_action_policy",
      // What this is, precisely: a way to find out what you may *offer*. It is
      // not the gate, and never was one — a verdict returned to the model is a
      // verdict the model can ignore. The gate is in the loop, keyed on the
      // tool's own declared tier, and it runs whether this is called or not.
      description:
        "What the policy for a given tier of action is: 'allowed', 'needs_approval', or 'forbidden'. Call this before offering to do something, so that what you offer matches what is permitted. This tells you the rule; it does not grant permission, and whether any action actually runs is decided outside this conversation.",
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
      // A description carries three things, because the prompt no longer does:
      // what the tool returns, when to reach for it, and why answering from
      // memory is wrong. Same for the two below.
      description:
        "Current weather conditions for a named place — temperature, wind, and sky. Call this whenever the user asks what it is like somewhere, or wants to plan around the weather. Conditions change hour to hour and you were not trained on today's, so never answer this from memory. A plan-quality signal only, never a diagnosis of anything about the user.",
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
        "Event listings near a place — concerts, shows, and games, from Ticketmaster — optionally narrowed by a keyword. Call this whenever the user asks what is on somewhere, or is looking for something to go to. Listings change daily and you were not trained on today's, so never answer this from memory. Useful for planning around, but not a claim about anything the user has committed to.",
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
        "Status of one specific flight — scheduled and revised times, airports, and whether it is running to time — by flight number and departure date. Call this whenever a specific flight comes up. Status changes hour to hour and you were not trained on today's, so never answer this from memory.",
      inputSchema: {
        type: "object",
        properties: {
          flightNumber: { type: "string", description: "e.g. 'UA1' or 'BA249'." },
          // The one parameter a caller under core rule 1 cannot derive: read it
          // off the resolved dates rather than counting days out.
          date: {
            type: "string",
            description:
              "The flight's departure date, as YYYY-MM-DD. Take it from the resolved dates you were given — do not work it out yourself.",
          },
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
    ...githubActionTools,
  ];
}

export { buildState, getActionPolicy };
export type { EngineState, StateCommitmentInput, ActionPolicy, ActionTier };
export type { WeatherReport, EventSummary, FlightStatus };
export type { GithubActionCommitment };
