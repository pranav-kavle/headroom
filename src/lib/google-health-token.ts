import { getGoogleHealthToken, upsertGoogleHealthToken } from "@headroom/graph";
import { refreshGoogleHealthToken } from "./google-health-oauth";
import { decryptToken, encryptToken } from "./token-encryption";

// Refresh a little before actual expiry so a sync never races a token that
// expires mid-request.
const EXPIRY_BUFFER_MS = 60_000;

export async function getValidGoogleHealthAccessToken(input: {
  userId: string;
  now: Date;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const token = await getGoogleHealthToken(input.userId);
  if (!token) return null;

  const accessToken = decryptToken(token.accessToken.encrypted, token.accessToken.iv, token.accessToken.authTag);

  if (token.expiresAt.getTime() - EXPIRY_BUFFER_MS > input.now.getTime()) {
    return accessToken;
  }

  const refreshToken = decryptToken(token.refreshToken.encrypted, token.refreshToken.iv, token.refreshToken.authTag);

  const refreshed = await refreshGoogleHealthToken({
    refreshToken,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    now: input.now,
    fetchImpl: input.fetchImpl,
  });

  await upsertGoogleHealthToken({
    userId: input.userId,
    accessToken: encryptToken(refreshed.accessToken),
    refreshToken: token.refreshToken,
    expiresAt: refreshed.expiresAt,
  });

  return refreshed.accessToken;
}

// Called once, right after the OAuth callback exchanges its code — the only
// other place a plaintext token ever exists before being encrypted for
// storage.
export async function saveGoogleHealthToken(input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<void> {
  await upsertGoogleHealthToken({
    userId: input.userId,
    accessToken: encryptToken(input.accessToken),
    refreshToken: encryptToken(input.refreshToken),
    expiresAt: input.expiresAt,
  });
}
