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

export function signThinkToken(
  userId: string,
  options: { now?: Date; ttlSeconds?: number; env?: EnvSource } = {},
): string {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const expiresAt = now.getTime() + (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;

  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  const signature = sign(payload, resolveSecret(env));
  return `${payload}.${signature}`;
}

export function verifyThinkToken(token: string, options: { now?: Date; env?: EnvSource } = {}): string {
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

  const { userId, expiresAt } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId: string;
    expiresAt: number;
  };

  if (now.getTime() > expiresAt) {
    throw new Error("Think token has expired");
  }

  return userId;
}
