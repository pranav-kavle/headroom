import { randomUUID } from "node:crypto";
import { prisma } from "./client";

export type UserRow = {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: Date;
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

export function listUsers(): Promise<Array<{ id: string; email: string; createdAt: Date }>> {
  return prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
