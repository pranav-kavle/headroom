// The only file in the repo that imports Prisma — design doc §11, port rule 6.
// Enforced by tests/architecture/prisma-boundary.test.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  headroomPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.headroomPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.headroomPrisma = prisma;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
