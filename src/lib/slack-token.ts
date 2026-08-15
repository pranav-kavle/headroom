import { getSlackToken, upsertSlackToken } from "@headroom/graph";
import { decryptToken, encryptToken } from "./token-encryption";

export interface SlackCredentials {
  accessToken: string;
  teamId: string;
  slackUserId: string;
}

// No refresh path, unlike Google Health: Slack user tokens stay valid until
// revoked unless token rotation is enabled on the app (2026-08-15 spec §2).
// If the token is ever revoked, Slack answers calls with ok:false
// "invalid_auth" and the sync surfaces that as a connector error.
export async function getSlackCredentials(userId: string): Promise<SlackCredentials | null> {
  const row = await getSlackToken(userId);
  if (!row) return null;

  return {
    accessToken: decryptToken(row.accessToken.encrypted, row.accessToken.iv, row.accessToken.authTag),
    teamId: row.teamId,
    slackUserId: row.slackUserId,
  };
}

// Called once, right after the OAuth callback exchanges its code — the only
// place a plaintext Slack token exists before being encrypted for storage.
export async function saveSlackToken(input: {
  userId: string;
  accessToken: string;
  teamId: string;
  slackUserId: string;
}): Promise<void> {
  await upsertSlackToken({
    userId: input.userId,
    accessToken: encryptToken(input.accessToken),
    teamId: input.teamId,
    slackUserId: input.slackUserId,
  });
}
