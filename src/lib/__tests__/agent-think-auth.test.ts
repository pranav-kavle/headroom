import { describe, expect, it } from "vitest";
import { signThinkToken, verifyThinkToken } from "../agent-think-auth";

const ENV = { AGENT_THINK_SECRET: "test-secret" };

describe("signThinkToken / verifyThinkToken", () => {
  it("round-trips the user id through a signed token", () => {
    const token = signThinkToken("user-1", { env: ENV });

    expect(verifyThinkToken(token, { env: ENV })).toBe("user-1");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signThinkToken("user-1", { env: ENV });

    expect(() => verifyThinkToken(token, { env: { AGENT_THINK_SECRET: "other-secret" } })).toThrow();
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = signThinkToken("user-1", { env: ENV });
    const [payload, signature] = token.split(".");
    const tampered = `${payload}x.${signature}`;

    expect(() => verifyThinkToken(tampered, { env: ENV })).toThrow();
  });

  it("rejects an expired token", () => {
    const signedAt = new Date("2026-08-12T09:00:00Z");
    const token = signThinkToken("user-1", { env: ENV, now: signedAt, ttlSeconds: 60 });

    const afterExpiry = new Date("2026-08-12T09:01:01Z");
    expect(() => verifyThinkToken(token, { env: ENV, now: afterExpiry })).toThrow(/expired/i);
  });

  it("throws naming AGENT_THINK_SECRET when it is missing", () => {
    expect(() => signThinkToken("user-1", { env: {} })).toThrow(/AGENT_THINK_SECRET/);
  });
});
