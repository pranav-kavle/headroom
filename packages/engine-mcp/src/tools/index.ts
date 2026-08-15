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
import { githubActionTools, type GithubActionArtifact } from "./github-actions";
import { checkGithubTool } from "./github-check";
import { slackTools, type SlackMessageArtifact } from "./slack";

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
  // The GitHub write actions' credential and artifact lookup — populated
  // the same way as the API keys above: the app layer resolves them, the
  // engine only ever receives what it was handed.
  //
  // Keyed on the Artifact, not the Commitment: every synced PR has an
  // artifact, but only PRs with a counterparty have a commitment, so
  // commitment-keyed actions could not reach your own reviewer-less PRs at
  // all. The artifact is also the unit provenance hangs off (§3 rule 2).
  githubToken?: string;
  getArtifactById?: (id: string, userId: string) => Promise<GithubActionArtifact | null>;
  // Called after a merge or close succeeds on GitHub. Acting on a PR is the
  // one moment its new state is known without asking, so waiting for the next
  // sync would leave the UI showing a PR as open right after the user watched
  // it merge. Injected rather than imported for the same reason as the lookup
  // above (port rule 6).
  markPullRequestClosed?: (artifactId: string, state: "merged" | "closed") => Promise<void>;
  // §8's approval path for Tier 2, injected for the same port-rule-6 reason as
  // everything above. The engine asks whether this exact call has already been
  // offered to the user and confirmed by them; the app layer answers from
  // stored Actions. Absent means no approval can ever resolve, which is the
  // old behaviour — offers are made and nothing runs.
  resolveApproval?: (call: {
    tool: string;
    tier: ActionTier;
    payload: Record<string, unknown>;
  }) => Promise<{ approved: boolean; actionId?: string }>;
  // Whether this exact outward-facing call has already been carried out.
  // Asked before approval is even considered, because "already sent" is a
  // different answer from "needs approval" and the gate owes the model the
  // true one: a duplicate request that left an unconsumed offer behind used to
  // make a second send look like a first. Absent means no completion is ever
  // detected, which is the old behaviour — a repeated call runs again.
  findCompletedAction?: (call: {
    tool: string;
    payload: Record<string, unknown>;
  }) => Promise<{ ranAt: string; externalRef?: string } | null>;
  recordActionExecuted?: (actionId: string, output: unknown) => Promise<void>;
  recordActionFailed?: (actionId: string) => Promise<void>;
  // Slack's credential and message read-back. One field rather than two
  // because the sync needs both halves — the token to call Slack, and the
  // user's own Slack id to tell their messages from everyone else's — and a
  // context holding one without the other is not a connected workspace.
  //
  // The read-back exists because Slack has no extraction yet (2026-08-15 spec
  // §1): its messages never become Commitments, so `listCommitments` above
  // cannot see them and check_slack would have nothing to show but a count.
  slackCredentials?: { accessToken: string; slackUserId: string };
  listRecentSlackMessages?: (userId: string, limit: number) => Promise<SlackMessageArtifact[]>;
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
      //
      // Keyed on the tool name, never on a tier the model supplies. It used to
      // take the tier, and core rule 3 held only for execution: asked to merge
      // a PR the model reasoned "merging is code, so Tier 4", got the right
      // verdict for Tier 4, and told the user merging was forbidden — while
      // merge_pr sat at Tier 2, one confirmation away from running, never
      // called. A correct answer to a question the model should not have been
      // able to ask.
      description:
        "Whether a specific tool may run: 'allowed', 'needs_approval', or 'forbidden'. Call this before offering to do something, so that what you offer matches what is permitted. Pass the tool's own name — the tier is resolved here, and is never yours to decide or infer. This tells you the rule; it does not grant permission.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The name of the tool you are considering, e.g. 'merge_pr'.",
          },
        },
        required: ["action"],
        additionalProperties: false,
      },
      handler: async (
        input,
        context,
      ): Promise<{ action: string; tier: ActionTier | null; policy: ActionPolicy }> => {
        const action = typeof input.action === "string" ? input.action : "";
        const tool = engineTools().find((t) => t.name === action);
        if (!tool) {
          throw new Error(`Unknown action: ${action || String(input.action)}`);
        }
        // No declared tier means a read — nothing outward-facing to gate.
        if (!tool.tier) {
          return { action, tier: null, policy: "allowed" };
        }
        const options: ActionPolicyOptions = { tier1Unattended: context.tier1Unattended };
        return { action, tier: tool.tier, policy: getActionPolicy(tool.tier, options) };
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
    checkGithubTool,
    ...githubActionTools,
    ...slackTools,
  ];
}

export { buildState, getActionPolicy };
export type { EngineState, StateCommitmentInput, ActionPolicy, ActionTier };
export type { WeatherReport, EventSummary, FlightStatus };
export type { GithubActionArtifact, SlackMessageArtifact };
