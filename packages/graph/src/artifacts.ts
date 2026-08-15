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

// Scoped by userId, not just id: the id alone comes from the model, and an
// artifact is the handle the GitHub write actions act through.
export function findArtifactById(id: string, userId: string): Promise<ArtifactRow | null> {
  return prisma.artifact.findFirst({ where: { id, userId } });
}

export type RecentArtifactRow = ArtifactRow & {
  authorPerson: { displayName: string } | null;
};

/**
 * The most recent artifacts from one source, newest first, with the author
 * joined so a quote can be attributed in the same pass.
 *
 * This is how a source with no extraction yet still reaches the model: Slack
 * messages never become Commitments (2026-08-15 spec §1), so `listCommitments`
 * cannot see them, and without this they exist in Postgres and nowhere else.
 * `limit` is required rather than defaulted — a caller that forgets it in a
 * workspace with 40,000 messages would put all of them in a prompt.
 */
export function listRecentArtifactsBySource(input: {
  userId: string;
  source: ArtifactSource;
  limit: number;
}): Promise<RecentArtifactRow[]> {
  return prisma.artifact.findMany({
    where: { userId: input.userId, source: input.source },
    include: { authorPerson: { select: { displayName: true } } },
    orderBy: [{ occurredAt: "desc" }],
    take: input.limit,
  });
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
