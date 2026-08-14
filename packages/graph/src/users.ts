import { randomUUID } from "node:crypto";
import { prisma } from "./client";

export type UserRow = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string | null;
  role: string | null;
  timezone: string | null;
  onboardedAt: Date | null;
  createdAt: Date;
};

export type OnboardingInput = {
  displayName: string;
  /** Both optional — the /welcome flow lets you skip the second card. */
  role?: string | null;
  timezone?: string | null;
};

export function findUserByClerkId(clerkUserId: string): Promise<UserRow | null> {
  return prisma.user.findUnique({ where: { clerkUserId } });
}

export function createUser(input: { clerkUserId: string; email: string }): Promise<UserRow> {
  // Explicit id: the schema's @default(uuid()) isn't surviving into the
  // Turbopack-bundled production server — inserts land with a null id there
  // even though this generated client works fine unbundled (e.g. in tests).
  return prisma.user.create({ data: { id: randomUUID(), ...input } });
}

/**
 * Records the answers from the /welcome flow and marks the user onboarded.
 *
 * `onboardedAt` is read before it is written so a second run through the flow
 * updates the answers without moving the original timestamp — see the test.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<UserRow> {
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { onboardedAt: true },
  });

  return prisma.user.update({
    where: { id: userId },
    data: {
      displayName: input.displayName,
      role: input.role ?? null,
      timezone: input.timezone ?? null,
      onboardedAt: existing.onboardedAt ?? new Date(),
    },
  });
}

export function listUsers(): Promise<Array<{ id: string; email: string; createdAt: Date }>> {
  return prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
