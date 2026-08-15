import { describe, expect, it } from "vitest";
import { engineTools, type EngineContext } from "../tools";
import type { StateCommitmentInput } from "../tools/state";

const NOW = new Date("2026-08-12T09:30:00Z");

function commitment(over: Partial<StateCommitmentInput> = {}): StateCommitmentInput {
  return {
    id: "c1",
    direction: "owed_by_me",
    summary: "Send Maya the deck",
    status: "open",
    dueAt: new Date("2026-08-13T00:00:00Z"),
    duePrecision: "day",
    quote: "I told Maya I'd get her the deck by Thursday",
    sourceArtifactId: "a1",
    counterpartyPerson: { displayName: "Maya Rodriguez" },
    ...over,
  };
}

function context(
  commitments: StateCommitmentInput[] = [],
  over: Partial<EngineContext> = {},
): EngineContext {
  return {
    userId: "u1",
    now: NOW,
    listCommitments: async () => commitments,
    ...over,
  };
}

function toolNamed(name: string) {
  const tool = engineTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

describe("engineTools", () => {
  it("exposes the engine tools built so far, under their design-doc §7/§16 names", () => {
    expect(engineTools().map((t) => t.name).sort()).toEqual([
      "check_github",
      "check_slack",
      "close_pr",
      "comment_on_pr",
      "get_action_policy",
      "get_events",
      "get_flight_status",
      "get_state",
      "get_weather",
      "list_slack_channels",
      "merge_pr",
      "send_slack_message",
    ]);
  });

  // Routing lives here, not in the system prompt — the prompt used to name
  // these three and restate what each was for, which is a second source of
  // truth that grows with the registry. A description now has to carry its own
  // trigger and its own reason not to answer from memory. Scoped to reads
  // (external and untiered) — the memory framing doesn't apply to a write
  // action, which is external but tiered.
  it("makes every live lookup self-describing — what it covers, when to call it, why memory is not enough", () => {
    for (const tool of engineTools().filter((t) => t.external && !t.tier)) {
      expect(tool.description, tool.name).toMatch(/call this whenever/i);
      expect(tool.description, tool.name).toMatch(/never answer this from memory/i);
      expect(tool.description, tool.name).toMatch(/not trained on today/i);
    }
  });

  // Core rule 1 reaches into the schema too: this is the one parameter the
  // model cannot derive under a prompt that forbids date arithmetic, so the
  // parameter itself says where to get it.
  it("tells the caller where a flight date comes from, rather than assuming it can count", () => {
    const date = (toolNamed("get_flight_status").inputSchema.properties as Record<string, { description: string }>)
      .date;

    expect(date.description).toMatch(/YYYY-MM-DD/);
    expect(date.description).toMatch(/resolved dates|do not work it out/i);
  });

  // The portability contract: plain JSON Schema, no SDK coupling, so the same
  // definitions feed the Anthropic turn loop today and Deepgram's Voice Agent
  // function calling later.
  it("describes every tool with a plain JSON Schema object", () => {
    for (const tool of engineTools()) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).not.toHaveProperty("_def"); // a Zod schema would have this
    }
  });

  // The voice loop needs to know which tools hit a live third-party API (and
  // are therefore slow enough to warrant a filler message) versus which ones
  // are the existing, fast, in-process engine reads. Write actions hit GitHub
  // too, so they're external as well — the tier is what separates a read from
  // an action needing the §8 gate.
  it("flags everything that hits a live third-party API as external, and the engine's own reads as not", () => {
    const external = engineTools()
      .filter((t) => t.external)
      .map((t) => t.name)
      .sort();
    expect(external).toEqual([
      "check_github",
      "check_slack",
      "close_pr",
      "comment_on_pr",
      "get_events",
      "get_flight_status",
      "get_weather",
      "list_slack_channels",
      "merge_pr",
      "send_slack_message",
    ]);

    expect(toolNamed("get_state").external).toBeFalsy();
    expect(toolNamed("get_action_policy").external).toBeFalsy();
  });

  it("tiers every outward-facing write as tier_2, and leaves the reads untiered", () => {
    for (const name of ["comment_on_pr", "close_pr", "merge_pr", "send_slack_message"]) {
      expect(toolNamed(name).tier, name).toBe("tier_2");
    }
    for (const name of [
      "get_state",
      "get_weather",
      "get_events",
      "get_flight_status",
      "get_action_policy",
      "check_github",
      "check_slack",
      "list_slack_channels",
    ]) {
      expect(toolNamed(name).tier, name).toBeUndefined();
    }
  });
});

describe("get_state handler", () => {
  it("returns engine-computed state for the context's user", async () => {
    const result = await toolNamed("get_state").handler({}, context([commitment()]));

    expect(result).toMatchObject({
      today: "2026-08-12",
      counts: { owedByMe: 1, owedToMe: 0 },
    });
  });

  it("passes the context's userId to the graph, never a model-supplied one", async () => {
    let askedFor: string | undefined;
    const ctx: EngineContext = {
      userId: "real-user",
      now: NOW,
      listCommitments: async (userId) => {
        askedFor = userId;
        return [];
      },
    };

    await toolNamed("get_state").handler({ userId: "attacker" }, ctx);

    expect(askedFor).toBe("real-user");
  });
});

describe("get_weather handler", () => {
  it("geocodes the requested location and returns current conditions", async () => {
    const fetchImpl = async (url: string | URL) => {
      if (url.toString().includes("geocoding-api")) {
        return new Response(JSON.stringify({ results: [{ latitude: 1, longitude: 2, name: "Nowhere" }] }));
      }
      return new Response(
        JSON.stringify({ current: { time: "2026-08-12T09:00", temperature_2m: 18, weather_code: 0, wind_speed_10m: 5 } }),
      );
    };

    const result = await toolNamed("get_weather").handler(
      { location: "Nowhere" },
      context([], { fetchImpl: fetchImpl as typeof fetch }),
    );

    expect(result).toMatchObject({ location: "Nowhere", temperatureC: 18, conditions: "clear sky" });
  });
});

describe("get_events handler", () => {
  it("passes the location and the context's Ticketmaster key through to the search", async () => {
    let requestedUrl = "";
    const fetchImpl = async (url: string | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify({ _embedded: { events: [] } }));
    };

    await toolNamed("get_events").handler(
      { location: "Chicago" },
      context([], { fetchImpl: fetchImpl as typeof fetch, ticketmasterApiKey: "tm-key" }),
    );

    const params = new URL(requestedUrl).searchParams;
    expect(params.get("apikey")).toBe("tm-key");
    expect(params.get("city")).toBe("Chicago");
  });
});

describe("get_flight_status handler", () => {
  it("passes the flight number, date, and the context's RapidAPI key through to the lookup", async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify([{ number: "UA 1", status: "Expected", departure: {}, arrival: {} }]));
    };

    const result = await toolNamed("get_flight_status").handler(
      { flightNumber: "UA1", date: "2026-08-14" },
      context([], { fetchImpl: fetchImpl as typeof fetch, rapidApiKey: "rapid-key" }),
    );

    expect(result).toMatchObject({ flightNumber: "UA 1", status: "Expected" });
    expect(capturedHeaders["x-rapidapi-key"]).toBe("rapid-key");
  });
});

describe("get_action_policy handler", () => {
  it("returns the deterministic policy for a tier", async () => {
    const result = await toolNamed("get_action_policy").handler(
      { tier: "tier_3", kind: "book_flight" },
      context(),
    );

    expect(result).toEqual({ policy: "forbidden" });
  });

  it("rejects a tier outside the known set rather than guessing", async () => {
    await expect(
      toolNamed("get_action_policy").handler({ tier: "tier_9" }, context()),
    ).rejects.toThrow(/tier/i);
  });
});
