import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthResponse, MeResponse, TranscriptionResponse, UsersResponse } from "@headroom/contracts";

const getOrCreateUser = vi.fn();
const listUsers = vi.fn();
const pingDatabase = vi.fn();
const createArtifact = vi.fn();
const transcribe = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
  createArtifact: (input: unknown) => createArtifact(input),
}));
vi.mock("@/lib/stt", () => ({
  StubSttProvider: vi.fn().mockImplementation(() => ({ transcribe })),
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

function makeVoiceRequest(final: boolean) {
  return new NextRequest(
    `http://localhost/api/v1/voice/transcriptions${final ? "?final=true" : ""}`,
    {
      method: "POST",
      headers: { "content-type": "audio/webm" },
      body: new Uint8Array([1, 2, 3]),
    },
  );
}

describe("POST /api/v1/voice/transcriptions", () => {
  it("returns 401 when signed out", async () => {
    getOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("../voice/transcriptions/route");

    expect((await POST(makeVoiceRequest(false))).status).toBe(401);
  });

  it("returns the running transcript without persisting anything for a non-final chunk", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    transcribe.mockResolvedValue({ transcript: "hey so I was" });
    const { POST } = await import("../voice/transcriptions/route");

    const response = await POST(makeVoiceRequest(false));

    expect(response.status).toBe(200);
    expect(TranscriptionResponse.parse(await response.json())).toEqual({
      transcript: "hey so I was",
      isFinal: false,
    });
    expect(createArtifact).not.toHaveBeenCalled();
  });

  it("persists a voice_note artifact and returns its id for the final chunk", async () => {
    getOrCreateUser.mockResolvedValue(USER_ROW);
    transcribe.mockResolvedValue({ transcript: "hey so I was thinking we should ship this" });
    createArtifact.mockResolvedValue({ id: "8e6f2f5a-1c1e-4e9a-9c1a-2c9f1e2b3a4d" });
    const { POST } = await import("../voice/transcriptions/route");

    const response = await POST(makeVoiceRequest(true));
    const body = TranscriptionResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({
      transcript: "hey so I was thinking we should ship this",
      isFinal: true,
      artifactId: "8e6f2f5a-1c1e-4e9a-9c1a-2c9f1e2b3a4d",
    });
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ROW.id,
        source: "voice_note",
        excerpt: "hey so I was thinking we should ship this",
      }),
    );
  });
});
