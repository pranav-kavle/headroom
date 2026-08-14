import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { ArtifactSource } from "./generated/prisma/client";

export type ArtifactRow = {
  id: string;
  userId: string;
  source: ArtifactSource;
  externalId: string | null;
  occurredAt: Date;
  authorPersonId: string | null;
  excerpt: string;
  url: string | null;
  rawRef: string | null;
  createdAt: Date;
};

export function createArtifact(input: {
  userId: string;
  source: ArtifactSource;
  occurredAt: Date;
  excerpt: string;
  externalId?: string;
  authorPersonId?: string;
  url?: string;
  rawRef?: string;
}): Promise<ArtifactRow> {
  // Explicit id — see the comment in users.ts createUser for why.
  return prisma.artifact.create({ data: { id: randomUUID(), ...input } });
}

export function findArtifactBySourceExternalId(
  userId: string,
  source: ArtifactSource,
  externalId: string,
): Promise<ArtifactRow | null> {
  return prisma.artifact.findUnique({
    where: { userId_source_externalId: { userId, source, externalId } },
  });
}
