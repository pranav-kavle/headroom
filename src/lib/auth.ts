import { redirect } from "next/navigation";
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

/**
 * The gate on every tab screen: signed in *and* through /welcome.
 *
 * Without the second half a new account lands on a Brief that greets nobody,
 * which is the state this flow exists to remove. Returns the row so callers
 * don't have to null-check what the redirect already guaranteed.
 */
export async function requireOnboardedUser(): Promise<UserRow> {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (!user.onboardedAt) {
    redirect("/welcome");
  }
  return user;
}
