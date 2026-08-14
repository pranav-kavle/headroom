import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentTokenResponse,
  AgentTurnsResponse,
  GithubSyncResponse,
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
const createArtifact = vi.fn();
const mintDeepgramAgentToken = vi.fn();
const signThinkToken = vi.fn();
const verifyThinkToken = vi.fn();
const runAgentTurn = vi.fn();
const getGithubAccessToken = vi.fn();
const syncGithub = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
  listCommitments: (userId: string) => listCommitments(userId),
  createArtifact: (input: unknown) => createArtifact(input),
  completeOnboarding: (userId: string, input: unknown) => completeOnboarding(userId, input),
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
vi.mock("@headroom/integrations", () => ({ syncGithub: (input: unknown) => syncGithub(input) }));

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
