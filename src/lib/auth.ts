import { auth, currentUser } from "@clerk/nextjs/server";
import { createUser, findUserByClerkId, type UserRow } from "@headroom/graph";

/**
 * Returns the Postgres User row for the signed-in Clerk session, creating it
 * on first sight (lazy sync — no Clerk webhook needed). Returns null if
 * there's no signed-in session.
 */
export async function getOrCreateUser(): Promise<UserRow | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await findUserByClerkId(clerkUserId);
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) {
    throw new Error(`Clerk user ${clerkUserId} has no primary email address`);
  }

  return createUser({ clerkUserId, email });
}
