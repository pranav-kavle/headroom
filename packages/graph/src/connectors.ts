import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { ArtifactSource, ConnectorCursorStatus } from "./generated/prisma/client";

export type ConnectorCursorRow = {
  id: string;
  userId: string;
  source: ArtifactSource;
  status: ConnectorCursorStatus;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  updatedAt: Date;
};

export function listConnectorCursors(userId: string): Promise<ConnectorCursorRow[]> {
  return prisma.connectorCursor.findMany({
    where: { userId },
    orderBy: { source: "asc" },
  });
}

export function upsertConnectorCursor(input: {
  userId: string;
  source: ArtifactSource;
  status: ConnectorCursorStatus;
  lastSyncedAt?: Date | null;
  errorMessage?: string | null;
}): Promise<ConnectorCursorRow> {
  return prisma.connectorCursor.upsert({
    where: { userId_source: { userId: input.userId, source: input.source } },
    create: {
      id: randomUUID(),
      userId: input.userId,
      source: input.source,
      status: input.status,
      lastSyncedAt: input.lastSyncedAt ?? null,
      errorMessage: input.errorMessage ?? null,
    },
    update: {
      status: input.status,
      lastSyncedAt: input.lastSyncedAt ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}
