import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { ArtifactSource, ConnectorCursorStatus, Prisma } from "./generated/prisma/client";

export type ConnectorCursorRow = {
  id: string;
  userId: string;
  source: ArtifactSource;
  status: ConnectorCursorStatus;
  cursor: Prisma.JsonValue | null;
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

export function getConnectorCursor(userId: string, source: ArtifactSource): Promise<ConnectorCursorRow | null> {
  return prisma.connectorCursor.findUnique({ where: { userId_source: { userId, source } } });
}

export function upsertConnectorCursor(input: {
  userId: string;
  source: ArtifactSource;
  status: ConnectorCursorStatus;
  cursor?: Prisma.InputJsonValue;
  lastSyncedAt?: Date | null;
  errorMessage?: string | null;
}): Promise<ConnectorCursorRow> {
  // `cursor` is omitted from the update unless explicitly passed. runIntegrationSync
  // flips status around every sync without knowing the payload, and defaulting it
  // to null there would wipe the resume point on every run.
  const cursorUpdate = input.cursor !== undefined ? { cursor: input.cursor } : {};

  return prisma.connectorCursor.upsert({
    where: { userId_source: { userId: input.userId, source: input.source } },
    create: {
      id: randomUUID(),
      userId: input.userId,
      source: input.source,
      status: input.status,
      cursor: input.cursor,
      lastSyncedAt: input.lastSyncedAt ?? null,
      errorMessage: input.errorMessage ?? null,
    },
    update: {
      status: input.status,
      ...cursorUpdate,
      lastSyncedAt: input.lastSyncedAt ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}
