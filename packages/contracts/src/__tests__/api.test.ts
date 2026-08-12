import { describe, expect, it } from "vitest";
import {
  AgentTokenResponse,
  AgentTurnCitationsResponse,
  ApiErrorResponse,
  HealthResponse,
  MeResponse,
  UserSummary,
  UsersResponse,
} from "../index";

const VALID_USER = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  email: "pranav@example.com",
  createdAt: "2026-08-11T09:30:00.000Z",
};

describe("UserSummary", () => {
  it("accepts a serialized user row", () => {
    expect(UserSummary.parse(VALID_USER)).toEqual(VALID_USER);
  });

  it("rejects a non-uuid id", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, id: "42" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, email: "nope" }).success).toBe(false);
  });

  it("rejects a Date instance — the wire format is an ISO string", () => {
    expect(UserSummary.safeParse({ ...VALID_USER, createdAt: new Date() }).success).toBe(false);
  });
});

describe("MeResponse / UsersResponse", () => {
  it("wraps a single user", () => {
    expect(MeResponse.parse({ user: VALID_USER }).user.email).toBe(VALID_USER.email);
  });

  it("wraps a list of users", () => {
    expect(UsersResponse.parse({ users: [VALID_USER] }).users).toHaveLength(1);
  });

  it("rejects a missing wrapper key", () => {
    expect(MeResponse.safeParse(VALID_USER).success).toBe(false);
  });
});

describe("HealthResponse", () => {
  it("accepts the healthy shape", () => {
    expect(HealthResponse.parse({ status: "ok", db: "connected" })).toEqual({
      status: "ok",
      db: "connected",
    });
  });

  it("accepts the unreachable shape with its message", () => {
    const down = { status: "error", db: "unreachable", message: "ECONNREFUSED" };
    expect(HealthResponse.parse(down)).toEqual(down);
  });

  it("rejects an error shape with no message", () => {
    expect(HealthResponse.safeParse({ status: "error", db: "unreachable" }).success).toBe(false);
  });
});

describe("AgentTokenResponse", () => {
  it("accepts Deepgram's connection token alongside the signed think token", () => {
    const body = {
      deepgramAccessToken: "dg-jwt",
      deepgramExpiresInSeconds: 30,
      thinkAuthToken: "signed-token",
    };
    expect(AgentTokenResponse.parse(body)).toEqual(body);
  });

  it("rejects a response missing the think token", () => {
    const body = { deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30 };
    expect(AgentTokenResponse.safeParse(body).success).toBe(false);
  });
});

describe("AgentTurnCitationsResponse", () => {
  it("accepts a list of citations", () => {
    const body = { citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }] };
    expect(AgentTurnCitationsResponse.parse(body)).toEqual(body);
  });

  it("accepts an empty list when nothing was recorded", () => {
    expect(AgentTurnCitationsResponse.parse({ citations: [] }).citations).toEqual([]);
  });
});

describe("ApiErrorResponse", () => {
  it("accepts the standard envelope", () => {
    expect(ApiErrorResponse.parse({ error: "Not signed in" }).error).toBe("Not signed in");
  });
});
