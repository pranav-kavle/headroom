import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthResponse, MeResponse, UsersResponse } from "@headroom/contracts";

const getOrCreateUser = vi.fn();
const listUsers = vi.fn();
const pingDatabase = vi.fn();

vi.mock("@/lib/auth", () => ({ getOrCreateUser: () => getOrCreateUser() }));
vi.mock("@headroom/graph", () => ({
  listUsers: () => listUsers(),
  pingDatabase: () => pingDatabase(),
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
