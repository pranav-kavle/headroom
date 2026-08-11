import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the Postgres User row for the signed-in Clerk session, creating it
 * on first sight (lazy sync — no Clerk webhook needed). Returns null if
 * there's no signed-in session.
 */
export async function getOrCreateUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) {
    throw new Error(`Clerk user ${clerkUserId} has no primary email address`);
  }

  return prisma.user.create({
    data: {
      clerkUserId,
      email,
    },
  });
}
