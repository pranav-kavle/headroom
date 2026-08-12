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
  return prisma.user.create({ data: input });
}

export function listUsers(): Promise<Array<{ id: string; email: string; createdAt: Date }>> {
  return prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
