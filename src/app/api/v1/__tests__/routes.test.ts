import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTokenResponse, AgentTurnCitationsResponse, HealthResponse, MeResponse, UsersResponse } from "@headroom/contracts";
import { recordCitations } from "@/lib/agent-think-citations";

const getOrCreateUser = vi.fn();
const listUsers = vi.fn();
const pingDatabase = vi.fn();
const listCommitments = vi.fn();
const mintDeepgramAgentToken = vi.fn();
const signThinkToken = vi.fn();
const verifyThinkToken = vi.fn();
const runAgentTurn = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
  listCommitments: (userId: string) => listCommitments(userId),
}));
vi.mock("@/lib/voice-agent-token", () => ({
  mintDeepgramAgentToken: () => mintDeepgramAgentToken(),
}));
vi.mock("@/lib/agent-think-auth", () => ({
  signThinkToken: (userId: string) => signThinkToken(userId),
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
  createdAt: new Date("2026-08-11T09:30:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
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
    getOrCreateUser.mockResolvedValue(USER_ROW);
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
    expect(signThinkToken).toHaveBeenCalledWith(USER_ROW.id);
  });

  it("returns 502 when Deepgram's grant endpoint fails", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    mintDeepgramAgentToken.mockRejectedValue(new Error("Deepgram token grant failed (401)"));
    const { POST } = await import("../voice/agent-token/route");

    expect((await POST()).status).toBe(502);
  });
});

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

  it("runs the agent turn on the latest user message and returns an OpenAI-shaped reply", async () => {
    verifyThinkToken.mockReturnValue(USER_ROW.id);
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
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.choices[0].message).toEqual({
      role: "assistant",
      content: "You owe Maya the deck.",
    });
    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: "what do I owe?" }),
    );
  });

  it("makes the turn's citations available for the client to poll", async () => {
    verifyThinkToken.mockReturnValue(USER_ROW.id);
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
