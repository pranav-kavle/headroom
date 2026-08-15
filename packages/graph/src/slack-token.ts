import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { EncryptedTokenValue } from "./google-health-token";
import type { Prisma } from "./generated/prisma/client";

export type SlackTokenRow = {
  id: string;
  userId: string;
  accessToken: EncryptedTokenValue;
  teamId: string;
  slackUserId: string;
  updatedAt: Date;
};

export async function getSlackToken(userId: string): Promise<SlackTokenRow | null> {
  const row = await prisma.slackToken.findUnique({ where: { userId } });
  return row as unknown as SlackTokenRow | null;
}

export async function upsertSlackToken(input: {
  userId: string;
  accessToken: EncryptedTokenValue;
  teamId: string;
  slackUserId: string;
}): Promise<SlackTokenRow> {
  const { userId, teamId, slackUserId } = input;
  const accessToken = input.accessToken as unknown as Prisma.InputJsonValue;
  const row = await prisma.slackToken.upsert({
    where: { userId },
    create: { id: randomUUID(), userId, accessToken, teamId, slackUserId },
    update: { accessToken, teamId, slackUserId },
  });
  return row as unknown as SlackTokenRow;
}
