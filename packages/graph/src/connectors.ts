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
