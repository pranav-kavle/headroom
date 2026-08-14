import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { Artifact, Commitment, CommitmentDirection, DuePrecision, Person } from "./generated/prisma/client";

export type CommitmentRow = Commitment & {
  counterpartyPerson: Person;
  sourceArtifact: Artifact;
};

const OPEN_STATUSES = ["open", "at_risk", "overdue"] as const;
const INCLUDE = { counterpartyPerson: true, sourceArtifact: true } as const;

export function listCommitments(userId: string): Promise<CommitmentRow[]> {
  return prisma.commitment.findMany({
    where: { userId },
    include: INCLUDE,
    orderBy: [{ dueAt: "asc" }],
  }).then((commitments) => sortByOpenFirst(commitments));
}

export function getCommitmentById(id: string, userId: string): Promise<CommitmentRow | null> {
  return prisma.commitment.findFirst({
    where: { id, userId },
    include: INCLUDE,
  });
}

/**
 * Creates a commitment and its "created" CommitmentEvent together — every
 * later status change (§5's belief invalidation) is also recorded as an
 * event, so a commitment's full history is never just the current row.
 */
export async function createCommitment(input: {
  userId: string;
  direction: CommitmentDirection;
  summary: string;
  counterpartyPersonId: string;
  dueAt: Date | null;
  duePrecision: DuePrecision;
  confidence: number;
  sourceArtifactId: string;
  quote: string;
}): Promise<CommitmentRow> {
  const id = randomUUID();
  const now = new Date();

  const commitment = await prisma.commitment.create({
    data: {
      id,
      userId: input.userId,
      direction: input.direction,
      summary: input.summary,
      counterpartyPersonId: input.counterpartyPersonId,
      dueAt: input.dueAt,
      duePrecision: input.duePrecision,
      confidence: input.confidence,
      sourceArtifactId: input.sourceArtifactId,
      quote: input.quote,
    },
    include: INCLUDE,
  });
  await prisma.commitmentEvent.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      commitmentId: id,
      kind: "created",
      artifactId: input.sourceArtifactId,
      at: now,
    },
  });
  return commitment;
}

/**
 * Closes a commitment as fulfilled or cancelled, with the artifact that
 * proved it — core rule 2 requires a traceable record, not just a prose
 * closedReason.
 */
export async function closeCommitment(input: {
  id: string;
  userId: string;
  status: "fulfilled" | "cancelled";
  reason: string;
  artifactId: string;
  at: Date;
}): Promise<CommitmentRow> {
  const commitment = await prisma.commitment.update({
    where: { id: input.id },
    data: { status: input.status, closedAt: input.at, closedReason: input.reason },
    include: INCLUDE,
  });
  await prisma.commitmentEvent.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      commitmentId: input.id,
      kind: input.status,
      artifactId: input.artifactId,
      at: input.at,
    },
  });
  return commitment;
}

export function findCommitmentBySourceArtifact(
  userId: string,
  sourceArtifactId: string,
): Promise<CommitmentRow | null> {
  return prisma.commitment.findUnique({
    where: { userId_sourceArtifactId: { userId, sourceArtifactId } },
    include: INCLUDE,
  });
}

function sortByOpenFirst(commitments: CommitmentRow[]): CommitmentRow[] {
  const rank = (c: CommitmentRow) => (OPEN_STATUSES.includes(c.status as (typeof OPEN_STATUSES)[number]) ? 0 : 1);
  return [...commitments].sort((a, b) => rank(a) - rank(b));
}
