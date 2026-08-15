import { clerkClient } from "@clerk/nextjs/server";

/**
 * The live Google access token for this Clerk user's connected account, or
 * null if they haven't connected one yet. Nothing is stored or encrypted on
 * our side for this source — Clerk holds and refreshes the token, and this
 * reads it fresh on every sync.
 */
export async function getGoogleAccessToken(clerkUserId: string): Promise<string | null> {
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(clerkUserId, "google");
  return tokens.data[0]?.token ?? null;
}
