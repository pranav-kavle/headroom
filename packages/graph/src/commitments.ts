import { prisma } from "./client";
import type { Artifact, Commitment, Person } from "./generated/prisma/client";

export type CommitmentRow = Commitment & {
  counterpartyPerson: Person;
  sourceArtifact: Artifact;
};

const OPEN_STATUSES = ["open", "at_risk", "overdue"] as const;

export function listCommitments(userId: string): Promise<CommitmentRow[]> {
  return prisma.commitment.findMany({
    where: { userId },
    include: { counterpartyPerson: true, sourceArtifact: true },
    orderBy: [{ dueAt: "asc" }],
  }).then((commitments) => sortByOpenFirst(commitments));
}

export function getCommitmentById(id: string, userId: string): Promise<CommitmentRow | null> {
  return prisma.commitment.findFirst({
    where: { id, userId },
    include: { counterpartyPerson: true, sourceArtifact: true },
  });
}

function sortByOpenFirst(commitments: CommitmentRow[]): CommitmentRow[] {
  const rank = (c: CommitmentRow) => (OPEN_STATUSES.includes(c.status as (typeof OPEN_STATUSES)[number]) ? 0 : 1);
  return [...commitments].sort((a, b) => rank(a) - rank(b));
}
