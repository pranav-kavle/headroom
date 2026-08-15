import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentTokenResponse,
  AgentTurnsResponse,
  GithubSyncResponse,
  GoogleCalendarSyncResponse,
  GoogleHealthSyncResponse,
  HealthResponse,
  MeResponse,
  UsersResponse,
} from "@headroom/contracts";
import { recordTurn, resetTurns } from "@/lib/agent-turns";

const getOrCreateUser = vi.fn();
const completeOnboarding = vi.fn();
const listUsers = vi.fn();
const pingDatabase = vi.fn();
const listCommitments = vi.fn();
const getCommitmentById = vi.fn();
const createArtifact = vi.fn();
const mintDeepgramAgentToken = vi.fn();
const signThinkToken = vi.fn();
const verifyThinkToken = vi.fn();
const runAgentTurn = vi.fn();
const getGithubAccessToken = vi.fn();
const syncGithub = vi.fn();
const getGoogleAccessToken = vi.fn();
const syncGoogleCalendar = vi.fn();
const syncGoogleHealth = vi.fn();
const buildGoogleHealthAuthorizeUrl = vi.fn();
const resolveGoogleClientCredentials = vi.fn();
const exchangeGoogleHealthCode = vi.fn();
const getValidGoogleHealthAccessToken = vi.fn();
const saveGoogleHealthToken = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
  listCommitments: (userId: string) => listCommitments(userId),
  getCommitmentById: (id: string, userId: string) => getCommitmentById(id, userId),
  createArtifact: (input: unknown) => createArtifact(input),
  completeOnboarding: (userId: string, input: unknown) => completeOnboarding(userId, input),
}));
vi.mock("@/lib/google-health-oauth", () => ({
  GOOGLE_HEALTH_STATE_COOKIE: "google_health_oauth_state",
  buildGoogleHealthAuthorizeUrl: (input: unknown) => buildGoogleHealthAuthorizeUrl(input),
  resolveGoogleClientCredentials: () => resolveGoogleClientCredentials(),
  exchangeGoogleHealthCode: (input: unknown) => exchangeGoogleHealthCode(input),
}));
vi.mock("@/lib/google-health-token", () => ({
  getValidGoogleHealthAccessToken: (input: unknown) => getValidGoogleHealthAccessToken(input),
  saveGoogleHealthToken: (input: unknown) => saveGoogleHealthToken(input),
}));
vi.mock("@/lib/voice-agent-token", () => ({
  mintDeepgramAgentToken: () => mintDeepgramAgentToken(),
}));
vi.mock("@/lib/agent-think-auth", () => ({
  signThinkToken: (userId: string, options?: unknown) => signThinkToken(userId, options),
  verifyThinkToken: (token: string) => verifyThinkToken(token),
}));
vi.mock("@/lib/agent", () => ({ resolveAnthropicApiKey: () => "sk-ant-test" }));
vi.mock("@/lib/agent-loop", () => ({
  runAgentTurn: (input: unknown) => runAgentTurn(input),
}));
vi.mock("@/lib/github-token", () => ({ getGithubAccessToken: (id: string) => getGithubAccessToken(id) }));
vi.mock("@/lib/google-token", () => ({ getGoogleAccessToken: (id: string) => getGoogleAccessToken(id) }));
vi.mock("@headroom/integrations", () => ({
  syncGithub: (input: unknown) => syncGithub(input),
  syncGoogleCalendar: (input: unknown) => syncGoogleCalendar(input),
  syncGoogleHealth: (input: unknown) => syncGoogleHealth(input),
}));

const USER_ROW = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  clerkUserId: "user_abc",
  email: "pranav@example.com",
  displayName: "Pranav",
  role: null,
  timezone: null,
  onboardedAt: new Date("2026-08-13T14:00:00.000Z"),
  createdAt: new Date("2026-08-11T09:30:00.000Z"),
};

// 2026-08-13 spec §3 — verifyThinkToken now returns the principal alongside
// the user id, so the think endpoint never reads the database for it.
const CLAIMS = {
  userId: USER_ROW.id,
  clerkUserId: USER_ROW.clerkUserId,
  displayName: "Priya Raman",
  role: "product counsel",
  timezone: "America/Chicago",
};

// runAgentTurn is mocked, so every reply it hands back needs the full turn
// shape the route now records.
function turnResult(over: Record<string, unknown> = {}) {
  return {
    turnId: "11111111-1111-4111-8111-111111111111",
    text: "ok",
    citations: [],
    toolCalls: [],
    blocked: [],
    violations: [],
    refused: false,
    timings: { totalMs: 5, turns: [] },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTurns();
  createArtifact.mockResolvedValue({ id: "artifact-1" });
});

describe("GET /api/v1/health", () => {
  it("returns a contract-valid ok body when the database answers", async () => {
    pingDatabase.mockResolvedValue(true);
    const { GET } = await import("../health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(HealthResponse.parse(await response.json())).toEqual({
      status: "ok",
      db: "connected",
    });
  });

  it("returns 503 with a contract-valid error body when it does not", async () => {
    pingDatabase.mockResolvedValue(false);
    const { GET } = await import("../health/route");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(HealthResponse.parse(await response.json()).status).toBe("error");
  });
});

describe("GET /api/v1/me", () => {
  it("serializes createdAt as an ISO string", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../me/route");

    const response = await GET();
    const body = MeResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.user.createdAt).toBe("2026-08-11T09:30:00.000Z");
  });

  it("does not leak the Clerk user id", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../me/route");

    expect(await (await GET()).json()).not.toHaveProperty("user.clerkUserId");
  });

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../me/route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });
});

describe("PATCH /api/v1/me", () => {
  function patch(body: unknown) {
    return new NextRequest("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("stores the onboarding answers and returns the updated user", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    completeOnboarding.mockResolvedValue({
      ...USER_ROW,
      displayName: "Pranav",
      role: "Corporate lawyer at Sidley",
      timezone: "America/New_York",
      onboardedAt: new Date("2026-08-13T14:00:00.000Z"),
    });
    const { PATCH } = await import("../me/route");

    const response = await PATCH(
      patch({
        displayName: "Pranav",
        role: "Corporate lawyer at Sidley",
        timezone: "America/New_York",
      }),
    );
    const body = MeResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(completeOnboarding).toHaveBeenCalledWith(USER_ROW.id, {
      displayName: "Pranav",
      role: "Corporate lawyer at Sidley",
      timezone: "America/New_York",
    });
    expect(body.user.displayName).toBe("Pranav");
    expect(body.user.onboardedAt).toBe("2026-08-13T14:00:00.000Z");
  });

  it("accepts a skipped second card", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    completeOnboarding.mockResolvedValue({
      ...USER_ROW,
      displayName: "Pranav",
      onboardedAt: new Date("2026-08-13T14:00:00.000Z"),
    });
    const { PATCH } = await import("../me/route");

    const response = await PATCH(patch({ displayName: "Pranav" }));
    const body = MeResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.user.role).toBeNull();
    expect(body.user.timezone).toBeNull();
  });

  it("rejects an empty name with 400 and writes nothing", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { PATCH } = await import("../me/route");

    const response = await PATCH(patch({ displayName: "   " }));

    expect(response.status).toBe(400);
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { PATCH } = await import("../me/route");

    const response = await PATCH(patch({ displayName: "Pranav" }));

    expect(response.status).toBe(401);
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/users", () => {
  it("returns a contract-valid list", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    listUsers.mockResolvedValue([
      { id: USER_ROW.id, email: USER_ROW.email, createdAt: USER_ROW.createdAt },
    ]);
    const { GET } = await import("../users/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(UsersResponse.parse(await response.json()).users).toHaveLength(1);
  });

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../users/route");

    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/v1/voice/agent-token", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("../voice/agent-token/route");

    expect((await POST()).status).toBe(401);
  });

  it("mints Deepgram's connection token and a signed think token when signed in", async () => {
    getOrCreateUser.mockResolvedValue({
      ...USER_ROW,
      displayName: "Priya Raman",
      role: "product counsel",
      timezone: "America/Chicago",
    });
    mintDeepgramAgentToken.mockResolvedValue({ accessToken: "dg-jwt", expiresInSeconds: 30 });
    signThinkToken.mockReturnValue("signed-think-token");
    const { POST } = await import("../voice/agent-token/route");

    const response = await POST();

    expect(response.status).toBe(200);
    expect(AgentTokenResponse.parse(await response.json())).toEqual({
      deepgramAccessToken: "dg-jwt",
      deepgramExpiresInSeconds: 30,
      thinkAuthToken: "signed-think-token",
    });
    // 2026-08-13 spec §3: the principal is embedded at mint time, where the
    // User row is already in hand, so the think endpoint never reads the
    // database on the voice hot path.
    expect(signThinkToken).toHaveBeenCalledWith(USER_ROW.id, {
      clerkUserId: USER_ROW.clerkUserId,
      principal: {
        displayName: "Priya Raman",
        role: "product counsel",
        timezone: "America/Chicago",
      },
    });
  });

  it("returns 502 when Deepgram's grant endpoint fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    mintDeepgramAgentToken.mockRejectedValue(new Error("Deepgram token grant failed (401)"));
    const { POST } = await import("../voice/agent-token/route");

    expect((await POST()).status).toBe(502);
  });
});

async function readSseEvents(response: Response): Promise<unknown[]> {
  const body = await response.text();
  return body
    .trim()
    .split("\n\n")
    .filter((event) => event && event !== "data: [DONE]")
    .map((event) => JSON.parse(event.replace(/^data: /, "")));
}

function makeThinkRequest(messages: unknown[], token?: string) {
  return new NextRequest("http://localhost/api/v1/agent/think", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ model: "headroom-agent", messages }),
  });
}

describe("POST /api/v1/agent/think", () => {
  it("returns 401 when there is no bearer token", async () => {
    const { POST } = await import("../agent/think/route");

    const response = await POST(makeThinkRequest([{ role: "user", content: "hi" }]));

    expect(response.status).toBe(401);
    expect(verifyThinkToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token fails verification", async () => {
    verifyThinkToken.mockImplementation(() => {
      throw new Error("Think token has expired");
    });
    const { POST } = await import("../agent/think/route");

    const response = await POST(makeThinkRequest([{ role: "user", content: "hi" }], "stale"));

    expect(response.status).toBe(401);
  });

  it("runs the agent turn on the latest user message and streams an OpenAI-shaped reply", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    runAgentTurn.mockResolvedValue(
      turnResult({
        text: "You owe Maya the deck.",
        citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
      }),
    );
    const { POST } = await import("../agent/think/route");

    const response = await POST(
      makeThinkRequest(
        [
          { role: "system", content: "You are Headroom." },
          { role: "user", content: "what do I owe?" },
        ],
        "valid",
      ),
    );

    expect(response.status).toBe(200);
    // Deepgram's custom think endpoint requires SSE — a plain JSON body runs
    // fine but is never spoken, confirmed live via the container logs.
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const events = (await readSseEvents(response)) as Array<{
      choices: [{ delta: { role?: string; content?: string } }];
    }>;
    expect(events[0].choices[0].delta).toEqual({ role: "assistant", content: "You owe Maya the deck." });
    // Spec §5: the whole conversation reaches the turn, not just the last line.
    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "what do I owe?" }],
        principal: {
          displayName: "Priya Raman",
          role: "product counsel",
          timezone: "America/Chicago",
        },
      }),
    );
  });

  // 2026-08-13 spec §6. The prompt claims the user's words are already stored;
  // until now nothing stored them.
  it("stores the utterance as a voice_note artifact", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    runAgentTurn.mockResolvedValue(turnResult({ text: "Got it." }));
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "I owe Maya the deck" }], "valid"));

    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ROW.id,
        source: "voice_note",
        excerpt: "I owe Maya the deck",
      }),
    );
  });

  it("stores nothing when the transcript is blank", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "   " }], "valid"));

    expect(createArtifact).not.toHaveBeenCalled();
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  // An echoed turn is the agent's own voice coming back through the mic.
  // Storing it would attribute Otto's words to the user and poison the graph
  // that extraction will later read.
  it("stores nothing when the turn is the agent's own voice echoed back", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    const { POST } = await import("../agent/think/route");

    await POST(
      makeThinkRequest(
        [
          { role: "user", content: "what do I owe?" },
          { role: "assistant", content: "You have nothing on file at the moment." },
          { role: "user", content: "you have nothing on file at the moment" },
        ],
        "valid",
      ),
    );

    expect(createArtifact).not.toHaveBeenCalled();
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  // §4.2: the engine resolves dates in the user's zone, and this is where it
  // learns which zone that is.
  it("hands the user's timezone to the engine", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    runAgentTurn.mockResolvedValue(turnResult());
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what day is it?" }], "valid"));

    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ timezone: "America/Chicago" }),
      }),
    );
  });

  // The GitHub write tools (comment_on_pr/close_pr/merge_pr) need a live token
  // per turn — Clerk holds it, keyed by the Clerk user id the think token now
  // carries, never the internal one.
  it("resolves a GitHub token from the claims' clerkUserId and hands it to the engine", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    getGithubAccessToken.mockResolvedValue("gho_live");
    runAgentTurn.mockResolvedValue(turnResult());
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what day is it?" }], "valid"));

    expect(getGithubAccessToken).toHaveBeenCalledWith(USER_ROW.clerkUserId);
    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ githubToken: "gho_live" }),
      }),
    );
  });

  it("leaves githubToken unset when GitHub is not connected", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    getGithubAccessToken.mockResolvedValue(null);
    runAgentTurn.mockResolvedValue(turnResult());
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what day is it?" }], "valid"));

    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ githubToken: undefined }),
      }),
    );
  });

  it("passes a getCommitmentById that delegates to the graph, scoped to this user", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    getGithubAccessToken.mockResolvedValue(null);
    runAgentTurn.mockResolvedValue(turnResult());
    getCommitmentById.mockResolvedValue({ id: "c1" });
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what day is it?" }], "valid"));

    const { context } = runAgentTurn.mock.calls[0][0] as { context: { getCommitmentById: (id: string, userId: string) => unknown } };
    await context.getCommitmentById("c1", "ignored");

    expect(getCommitmentById).toHaveBeenCalledWith("c1", USER_ROW.id);
  });

  // 2026-08-13 spec §2: the turn is recorded whole — what was spoken, what
  // backs it, what ran, and what the gate refused to run.
  it("records the turn, so its evidence can be found by the utterance it belongs to", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    runAgentTurn.mockResolvedValue(
      turnResult({
        text: "You owe Maya the deck.",
        citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
        toolCalls: ["get_state"],
      }),
    );
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what do I owe?" }], "valid"));
    const { GET } = await import("../agent/think/turns/route");
    getOrCreateUser.mockResolvedValue(USER_ROW);

    expect(AgentTurnsResponse.parse(await (await GET()).json())).toEqual({
      turns: [
        {
          turnId: "11111111-1111-4111-8111-111111111111",
          text: "You owe Maya the deck.",
          citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
        },
      ],
    });
  });
});

describe("GET /api/v1/agent/think/turns", () => {
  function recorded(over: Record<string, unknown> = {}) {
    recordTurn({
      turnId: "t1",
      userId: USER_ROW.id,
      text: "You owe Maya the deck.",
      citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
      toolCalls: ["get_state"],
      blocked: [],
      violations: [],
      totalMs: 800,
      createdAt: "2026-08-13T14:00:00.000Z",
      ...over,
    });
  }

  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../agent/think/turns/route");

    expect((await GET()).status).toBe(401);
  });

  it("returns an empty list when the user has no turns yet", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../agent/think/turns/route");

    expect(AgentTurnsResponse.parse(await (await GET()).json())).toEqual({ turns: [] });
  });

  // The endpoint this replaces drained what it served, so a re-render or a
  // second tab could take the evidence belonging to an utterance that had not
  // rendered yet.
  it("does not consume what it serves", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    recorded();
    const { GET } = await import("../agent/think/turns/route");

    await GET();
    const second = AgentTurnsResponse.parse(await (await GET()).json());

    expect(second.turns).toHaveLength(1);
    expect(second.turns[0].citations).toHaveLength(1);
  });

  it("never serves another user's turns", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    recorded({ turnId: "theirs", userId: "someone-else" });
    const { GET } = await import("../agent/think/turns/route");

    expect(AgentTurnsResponse.parse(await (await GET()).json())).toEqual({ turns: [] });
  });
});

describe("POST /api/v1/integrations/github/sync", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("../integrations/github/sync/route");

    expect((await POST()).status).toBe(401);
  });

  it("returns 400 when GitHub is not connected yet", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGithubAccessToken.mockResolvedValue(null);
    const { POST } = await import("../integrations/github/sync/route");

    const response = await POST();

    expect(response.status).toBe(400);
    expect(syncGithub).not.toHaveBeenCalled();
  });

  it("syncs and returns the summary when connected", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGithubAccessToken.mockResolvedValue("gho_live");
    syncGithub.mockResolvedValue({ created: 2, closed: 1 });
    const { POST } = await import("../integrations/github/sync/route");

    const response = await POST();
    const body = GithubSyncResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({ created: 2, closed: 1 });
    expect(syncGithub).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ROW.id, token: "gho_live" }),
    );
  });

  it("returns 502 when the sync itself fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGithubAccessToken.mockResolvedValue("gho_live");
    syncGithub.mockRejectedValue(new Error("GitHub GraphQL error: rate limited"));
    const { POST } = await import("../integrations/github/sync/route");

    expect((await POST()).status).toBe(502);
  });
});

describe("POST /api/v1/integrations/google-calendar/sync", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("../integrations/google-calendar/sync/route");

    expect((await POST()).status).toBe(401);
  });

  it("returns 400 when Google is not connected yet", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGoogleAccessToken.mockResolvedValue(null);
    const { POST } = await import("../integrations/google-calendar/sync/route");

    const response = await POST();

    expect(response.status).toBe(400);
    expect(syncGoogleCalendar).not.toHaveBeenCalled();
  });

  it("syncs and returns the summary when connected", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGoogleAccessToken.mockResolvedValue("ya29_live");
    syncGoogleCalendar.mockResolvedValue({ daysSynced: 8 });
    const { POST } = await import("../integrations/google-calendar/sync/route");

    const response = await POST();
    const body = GoogleCalendarSyncResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({ daysSynced: 8 });
    expect(syncGoogleCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ROW.id, token: "ya29_live" }),
    );
  });

  it("returns 502 when the sync itself fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    getGoogleAccessToken.mockResolvedValue("ya29_live");
    syncGoogleCalendar.mockRejectedValue(new Error("Google Calendar API error: rate limited"));
    const { POST } = await import("../integrations/google-calendar/sync/route");

    expect((await POST()).status).toBe(502);
  });
});

describe("POST /api/v1/integrations/google-health/sync", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("../integrations/google-health/sync/route");

    expect((await POST()).status).toBe(401);
  });

  it("returns 400 when Google Health is not connected yet", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    getValidGoogleHealthAccessToken.mockResolvedValue(null);
    const { POST } = await import("../integrations/google-health/sync/route");

    const response = await POST();

    expect(response.status).toBe(400);
    expect(syncGoogleHealth).not.toHaveBeenCalled();
  });

  it("syncs and returns the summary when connected", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    getValidGoogleHealthAccessToken.mockResolvedValue("ya29_live");
    syncGoogleHealth.mockResolvedValue({ pointsSynced: 3 });
    const { POST } = await import("../integrations/google-health/sync/route");

    const response = await POST();
    const body = GoogleHealthSyncResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({ pointsSynced: 3 });
    expect(syncGoogleHealth).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ROW.id, token: "ya29_live" }),
    );
  });

  it("returns 502 when the sync itself fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    getValidGoogleHealthAccessToken.mockResolvedValue("ya29_live");
    syncGoogleHealth.mockRejectedValue(new Error("Google Health API error (sleep): rate limited"));
    const { POST } = await import("../integrations/google-health/sync/route");

    expect((await POST()).status).toBe(502);
  });
});

describe("GET /api/v1/integrations/google-health/authorize", () => {
  it("redirects to sign-in when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../integrations/google-health/authorize/route");

    const response = await GET(new NextRequest("http://localhost/api/v1/integrations/google-health/authorize"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
  });

  it("redirects to the built authorize URL and sets the state cookie", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    buildGoogleHealthAuthorizeUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
    const { GET } = await import("../integrations/google-health/authorize/route");

    const response = await GET(new NextRequest("http://localhost/api/v1/integrations/google-health/authorize"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
    expect(buildGoogleHealthAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-123",
        redirectUri: "http://localhost/api/v1/integrations/google-health/callback",
      }),
    );
    const cookie = response.cookies.get("google_health_oauth_state");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.value).toBe(buildGoogleHealthAuthorizeUrl.mock.calls[0][0].state);
  });

  it("builds an HTTPS redirect_uri from forwarded headers behind a TLS-terminating proxy", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    buildGoogleHealthAuthorizeUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
    const { GET } = await import("../integrations/google-health/authorize/route");

    // Azure Container Apps terminates TLS upstream and forwards internally
    // over plain HTTP — Google rejects a non-HTTPS redirect_uri outright for
    // a non-localhost app, so this is the exact shape that broke in
    // production (2026-08-15).
    await GET(
      new NextRequest("http://internal-container:3000/api/v1/integrations/google-health/authorize", {
        headers: { "x-forwarded-proto": "https", "x-forwarded-host": "headroom.apps.human-angle.com" },
      }),
    );

    expect(buildGoogleHealthAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: "https://headroom.apps.human-angle.com/api/v1/integrations/google-health/callback",
      }),
    );
  });
});

describe("GET /api/v1/integrations/google-health/callback", () => {
  function callbackRequest(query: string, cookieState?: string) {
    return new NextRequest(`http://localhost/api/v1/integrations/google-health/callback${query}`, {
      headers: cookieState ? { cookie: `google_health_oauth_state=${cookieState}` } : {},
    });
  }

  it("redirects to sign-in when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../integrations/google-health/callback/route");

    const response = await GET(callbackRequest("?code=abc&state=xyz", "xyz"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
  });

  it("redirects to /controls without exchanging when state doesn't match the cookie", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../integrations/google-health/callback/route");

    const response = await GET(callbackRequest("?code=abc&state=xyz", "different-state"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/controls");
    expect(exchangeGoogleHealthCode).not.toHaveBeenCalled();
  });

  it("redirects to /controls without exchanging when code is missing", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../integrations/google-health/callback/route");

    const response = await GET(callbackRequest("?state=xyz&error=access_denied", "xyz"));

    expect(response.status).toBe(307);
    expect(exchangeGoogleHealthCode).not.toHaveBeenCalled();
  });

  it("exchanges the code and stores the token when state matches", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    exchangeGoogleHealthCode.mockResolvedValue({
      accessToken: "ya29.new",
      refreshToken: "1//new-refresh",
      expiresAt: new Date("2026-08-15T05:00:00.000Z"),
    });
    saveGoogleHealthToken.mockResolvedValue(undefined);
    const { GET } = await import("../integrations/google-health/callback/route");

    const response = await GET(callbackRequest("?code=auth-code-1&state=xyz", "xyz"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/controls");
    expect(exchangeGoogleHealthCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: "auth-code-1", clientId: "client-123", clientSecret: "secret-abc" }),
    );
    expect(saveGoogleHealthToken).toHaveBeenCalledWith({
      userId: USER_ROW.id,
      accessToken: "ya29.new",
      refreshToken: "1//new-refresh",
      expiresAt: new Date("2026-08-15T05:00:00.000Z"),
    });
  });

  it("still redirects to /controls when the exchange fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    resolveGoogleClientCredentials.mockReturnValue({ clientId: "client-123", clientSecret: "secret-abc" });
    exchangeGoogleHealthCode.mockRejectedValue(new Error("Google token exchange failed: Bad code"));
    const { GET } = await import("../integrations/google-health/callback/route");

    const response = await GET(callbackRequest("?code=bad&state=xyz", "xyz"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/controls");
    expect(saveGoogleHealthToken).not.toHaveBeenCalled();
  });
});
