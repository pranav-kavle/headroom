import { describe, expect, it } from "vitest";
import { signThinkToken, verifyThinkToken } from "../agent-think-auth";

const ENV = { AGENT_THINK_SECRET: "test-secret" };

describe("signThinkToken / verifyThinkToken", () => {
  it("round-trips the user id through a signed token", () => {
    const token = signThinkToken("user-1", { env: ENV });

    expect(verifyThinkToken(token, { env: ENV }).userId).toBe("user-1");
  });

  // 2026-08-13 spec §3. The principal travels in the token so the think
  // endpoint never has to read the database on the voice hot path.
  it("carries the principal — name, role, and timezone — through the signature", () => {
    const token = signThinkToken("user-1", {
      env: ENV,
      principal: { displayName: "Priya Raman", role: "product counsel", timezone: "America/Chicago" },
    });

    expect(verifyThinkToken(token, { env: ENV })).toEqual({
      userId: "user-1",
      clerkUserId: null,
      displayName: "Priya Raman",
      role: "product counsel",
      timezone: "America/Chicago",
    });
  });

  // A token minted before this shipped must keep working — an open session
  // should not be forced to re-auth to gain a field it can live without.
  it("verifies a token minted without a principal, yielding nulls", () => {
    const legacy = signThinkToken("user-1", { env: ENV });

    expect(verifyThinkToken(legacy, { env: ENV })).toEqual({
      userId: "user-1",
      clerkUserId: null,
      displayName: null,
      role: null,
      timezone: null,
    });
  });

  // The GitHub write tools resolve a live token via Clerk, keyed by the Clerk
  // user id — a separate id from the internal one the token is bound to.
  it("carries the Clerk user id through the signature, for resolving the GitHub token", () => {
    const token = signThinkToken("user-1", { env: ENV, clerkUserId: "clerk-user-1" });

    expect(verifyThinkToken(token, { env: ENV }).clerkUserId).toBe("clerk-user-1");
  });

  it("rejects a token whose principal was edited after signing", () => {
    const token = signThinkToken("user-1", {
      env: ENV,
      principal: { displayName: "Priya", role: null, timezone: null },
    });
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "user-2", expiresAt: Date.now() + 60_000, displayName: "Someone Else" }),
    ).toString("base64url");

    expect(() => verifyThinkToken(`${forged}.${signature}`, { env: ENV })).toThrow();
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
