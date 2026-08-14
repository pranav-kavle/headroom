import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { IdentityKind } from "./generated/prisma/client";

export type PersonRow = {
  id: string;
  userId: string;
  displayName: string;
  primaryEmail: string | null;
  githubLogin: string | null;
  createdAt: Date;
};

/**
 * Finds the Person already linked to this identity, or creates both the
 * Person and the Identity together. The unique constraint on
 * (userId, kind, value) is what makes re-running a sync safe — the same
 * GitHub login always resolves to the same Person, and an existing match is
 * never overwritten (design doc §6: never merged silently).
 */
export async function resolvePerson(input: {
  userId: string;
  kind: IdentityKind;
  value: string;
  confidence: number;
  displayName: string;
  githubLogin?: string;
}): Promise<PersonRow> {
  const existing = await prisma.identity.findUnique({
    where: { userId_kind_value: { userId: input.userId, kind: input.kind, value: input.value } },
    include: { person: true },
  });
  if (existing) return existing.person;

  const person = await prisma.person.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      displayName: input.displayName,
      githubLogin: input.githubLogin ?? null,
    },
  });
  await prisma.identity.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      personId: person.id,
      kind: input.kind,
      value: input.value,
      confidence: input.confidence,
    },
  });
  return person;
}

/**
 * Gets or creates the Person representing the user themself, and links it via
 * User.selfPersonId. Without this the engine cannot tell "I promised Maya"
 * from "Maya promised me" (design doc §5).
 */
export async function ensureSelfPerson(input: {
  userId: string;
  displayName: string;
  githubLogin?: string;
}): Promise<PersonRow> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { selfPersonId: true },
  });
  if (user.selfPersonId) {
    return prisma.person.findUniqueOrThrow({ where: { id: user.selfPersonId } });
  }

  const person = await prisma.person.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      displayName: input.displayName,
      githubLogin: input.githubLogin ?? null,
    },
  });
  await prisma.user.update({ where: { id: input.userId }, data: { selfPersonId: person.id } });
  return person;
}
