import { describe, expect, it } from "vitest";
import {
  AgentTokenResponse,
  AgentTurnsResponse,
  ApiErrorResponse,
  CompleteOnboardingRequest,
  GithubSyncResponse,
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

// /me carries the onboarding answers on top of the summary; /users does not.
const VALID_ME_USER = {
  ...VALID_USER,
  displayName: "Pranav",
  role: null,
  timezone: "America/New_York",
  onboardedAt: "2026-08-13T14:00:00.000Z",
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
    expect(MeResponse.parse({ user: VALID_ME_USER }).user.email).toBe(VALID_USER.email);
  });

  it("carries a not-yet-onboarded user as nulls, not as absent keys", () => {
    const fresh = {
      ...VALID_USER,
      displayName: null,
      role: null,
      timezone: null,
      onboardedAt: null,
    };

    expect(MeResponse.parse({ user: fresh }).user.onboardedAt).toBeNull();
  });

  it("rejects a /me user missing the profile fields", () => {
    expect(MeResponse.safeParse({ user: VALID_USER }).success).toBe(false);
  });

  it("wraps a list of users", () => {
    expect(UsersResponse.parse({ users: [VALID_USER] }).users).toHaveLength(1);
  });

  it("rejects a missing wrapper key", () => {
    expect(MeResponse.safeParse(VALID_ME_USER).success).toBe(false);
  });
});

describe("CompleteOnboardingRequest", () => {
  it("accepts a name alone — the second card is skippable", () => {
    expect(CompleteOnboardingRequest.parse({ displayName: "Pranav" })).toEqual({
      displayName: "Pranav",
    });
  });

  it("trims before it validates, so whitespace is not a name", () => {
    expect(CompleteOnboardingRequest.safeParse({ displayName: "   " }).success).toBe(false);
  });

  it("accepts explicit nulls for the optional answers", () => {
    const parsed = CompleteOnboardingRequest.parse({
      displayName: "Pranav",
      role: null,
      timezone: null,
    });

    expect(parsed.role).toBeNull();
  });

  it("rejects a name longer than the column allows for", () => {
    expect(
      CompleteOnboardingRequest.safeParse({ displayName: "x".repeat(81) }).success,
    ).toBe(false);
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

describe("AgentTurnsResponse", () => {
  it("carries each turn's id, spoken text, and citations", () => {
    const body = {
      turns: [
        {
          turnId: "t1",
          text: "You owe Maya the deck.",
          citations: [{ artifactId: "a1", quote: "I owe Maya the deck" }],
        },
      ],
    };
    expect(AgentTurnsResponse.parse(body)).toEqual(body);
  });

  // 2026-08-13 spec §2.1: `text` is the key the client matches on, so a turn
  // without it cannot be correlated to the utterance it belongs to.
  it("rejects a turn with no spoken text to match on", () => {
    const body = { turns: [{ turnId: "t1", citations: [] }] };
    expect(AgentTurnsResponse.safeParse(body).success).toBe(false);
  });

  it("accepts an empty list when the user has no turns yet", () => {
    expect(AgentTurnsResponse.parse({ turns: [] }).turns).toEqual([]);
  });
});

describe("ApiErrorResponse", () => {
  it("accepts the standard envelope", () => {
    expect(ApiErrorResponse.parse({ error: "Not signed in" }).error).toBe("Not signed in");
  });
});

describe("GithubSyncResponse", () => {
  it("accepts a summary of created and closed counts", () => {
    expect(GithubSyncResponse.parse({ created: 2, closed: 1 })).toEqual({ created: 2, closed: 1 });
  });

  it("rejects a missing field", () => {
    expect(() => GithubSyncResponse.parse({ created: 2 })).toThrow();
  });
});
