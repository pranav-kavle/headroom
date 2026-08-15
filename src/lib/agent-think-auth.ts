import { createHmac, timingSafeEqual } from "node:crypto";
import type { EnvSource } from "./env";

// Deepgram Voice Agent design doc §5. Deepgram calls /api/v1/agent/think
// directly — there's no browser cookie on that request — so identity has to
// travel as a signed, user-bound token the browser embeds in the Settings
// message's custom header when it opens the session. This is that token.
const DEFAULT_TTL_SECONDS = 30 * 60;

function resolveSecret(env: EnvSource): string {
  const secret = env.AGENT_THINK_SECRET;
  if (!secret) {
    throw new Error("AGENT_THINK_SECRET is not set — the think endpoint cannot authenticate callers.");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// 2026-08-13 spec §3. The principal rides inside the token rather than being
// looked up per turn: this endpoint is on the voice hot path, the mint route
// already holds the `User` row, and the token is already signed and user-bound.
// A `findUserById` per utterance would buy freshness nobody needs — nobody
// renames themselves mid-conversation — and pay for it with a database round
// trip against a 1.5-3s first-audio budget.
export interface ThinkTokenClaims {
  userId: string;
  // The Clerk user id, kept separate from the display-facing principal below
  // — this is identity plumbing for resolving the GitHub token per turn, not
  // something spoken or logged as part of who the user is.
  clerkUserId: string | null;
  displayName: string | null;
  role: string | null;
  timezone: string | null;
}

export function signThinkToken(
  userId: string,
  options: {
    now?: Date;
    ttlSeconds?: number;
    env?: EnvSource;
    clerkUserId?: string | null;
    principal?: Omit<ThinkTokenClaims, "userId" | "clerkUserId">;
  } = {},
): string {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const expiresAt = now.getTime() + (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;

  const payload = Buffer.from(
    JSON.stringify({
      userId,
      clerkUserId: options.clerkUserId ?? null,
      expiresAt,
      displayName: options.principal?.displayName ?? null,
      role: options.principal?.role ?? null,
      timezone: options.principal?.timezone ?? null,
    }),
  ).toString("base64url");
  const signature = sign(payload, resolveSecret(env));
  return `${payload}.${signature}`;
}

export function verifyThinkToken(
  token: string,
  options: { now?: Date; env?: EnvSource } = {},
): ThinkTokenClaims {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    throw new Error("Malformed think token");
  }

  const expected = sign(payload, resolveSecret(env));
  if (!signaturesMatch(signature, expected)) {
    throw new Error("Invalid think token signature");
  }

  // The principal fields are optional on the way in, so a token minted before
  // this deploy still verifies — it just yields a nameless principal and no
  // Clerk id, rather than forcing every open session to re-auth.
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId: string;
    expiresAt: number;
    clerkUserId?: string | null;
    displayName?: string | null;
    role?: string | null;
    timezone?: string | null;
  };

  if (now.getTime() > claims.expiresAt) {
    throw new Error("Think token has expired");
  }

  return {
    userId: claims.userId,
    clerkUserId: claims.clerkUserId ?? null,
    displayName: claims.displayName ?? null,
    role: claims.role ?? null,
    timezone: claims.timezone ?? null,
  };
}
