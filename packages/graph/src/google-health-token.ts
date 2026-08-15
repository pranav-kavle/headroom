import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { Prisma } from "./generated/prisma/client";

// The shape produced by src/lib/token-encryption.ts's encryptToken() — the
// graph layer stores and returns it opaquely and never decrypts, since
// decryption needs TOKEN_ENCRYPTION_KEY, an app-layer (src/lib) concern.
export interface EncryptedTokenValue {
  encrypted: string;
  iv: string;
  authTag: string;
}

export type GoogleHealthTokenRow = {
  id: string;
  userId: string;
  accessToken: EncryptedTokenValue;
  refreshToken: EncryptedTokenValue;
  expiresAt: Date;
  updatedAt: Date;
};

export async function getGoogleHealthToken(userId: string): Promise<GoogleHealthTokenRow | null> {
  const row = await prisma.googleHealthToken.findUnique({ where: { userId } });
  return row as unknown as GoogleHealthTokenRow | null;
}

export async function upsertGoogleHealthToken(input: {
  userId: string;
  accessToken: EncryptedTokenValue;
  refreshToken: EncryptedTokenValue;
  expiresAt: Date;
}): Promise<GoogleHealthTokenRow> {
  const { userId, expiresAt } = input;
  const accessToken = input.accessToken as unknown as Prisma.InputJsonValue;
  const refreshToken = input.refreshToken as unknown as Prisma.InputJsonValue;
  const row = await prisma.googleHealthToken.upsert({
    where: { userId },
    create: { id: randomUUID(), userId, accessToken, refreshToken, expiresAt },
    update: { accessToken, refreshToken, expiresAt },
  });
  return row as unknown as GoogleHealthTokenRow;
}
