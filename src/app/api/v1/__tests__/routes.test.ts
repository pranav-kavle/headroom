import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTokenResponse, AgentTurnCitationsResponse, HealthResponse, MeResponse, UsersResponse } from "@headroom/contracts";
import { recordCitations } from "@/lib/agent-think-citations";

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

beforeEach(() => {
  vi.clearAllMocks();
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
    runAgentTurn.mockResolvedValue({
      text: "You owe Maya the deck.",
      citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
      refused: false,
      timings: { totalMs: 5, turns: [] },
    });
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
    runAgentTurn.mockResolvedValue({
      text: "Got it.",
      citations: [],
      refused: false,
      timings: { totalMs: 5, turns: [] },
    });
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
    runAgentTurn.mockResolvedValue({
      text: "ok",
      citations: [],
      refused: false,
      timings: { totalMs: 5, turns: [] },
    });
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what day is it?" }], "valid"));

    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ timezone: "America/Chicago" }),
      }),
    );
  });

  it("makes the turn's citations available for the client to poll", async () => {
    verifyThinkToken.mockReturnValue(CLAIMS);
    runAgentTurn.mockResolvedValue({
      text: "You owe Maya the deck.",
      citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
      refused: false,
      timings: { totalMs: 5, turns: [] },
    });
    const { POST } = await import("../agent/think/route");

    await POST(makeThinkRequest([{ role: "user", content: "what do I owe?" }], "valid"));
    const { GET } = await import("../agent/think/citations/route");
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const response = await GET();

    expect(AgentTurnCitationsResponse.parse(await response.json())).toEqual({
      citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
    });
  });
});

describe("GET /api/v1/agent/think/citations", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("../agent/think/citations/route");

    expect((await GET()).status).toBe(401);
  });

  it("returns an empty list when nothing was recorded for that user", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    const { GET } = await import("../agent/think/citations/route");

    const response = await GET();

    expect(AgentTurnCitationsResponse.parse(await response.json())).toEqual({ citations: [] });
  });

  it("clears citations once served, so a stale turn doesn't resurface", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    recordCitations(USER_ROW.id, [{ artifactId: "a1", quote: "I owe Maya the deck" }]);
    const { GET } = await import("../agent/think/citations/route");

    await GET();
    const second = await GET();

    expect(AgentTurnCitationsResponse.parse(await second.json())).toEqual({ citations: [] });
  });
});
