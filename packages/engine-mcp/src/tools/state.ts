// Design doc §7's `get_state`. Deliberately pure: `now` and the commitment rows
// are injected, so every date, count, and ordering in here is deterministic and
// testable without a database. The MCP tool handler does the fetching.
//
// Capacity signals and current load are absent from the return shape on purpose
// — both need `CapacitySignal` rows, and no connector produces them yet.

// Structural, not Prisma's generated row type: the engine has no business
// depending on the graph's exact shape (and port rule 6 keeps Prisma out of
// here entirely). `CommitmentRow` satisfies this already.
export interface StateCommitmentInput {
  id: string;
  direction: string;
  summary: string;
  status: string;
  dueAt: Date | null;
  duePrecision: string;
  quote: string;
  sourceArtifactId: string;
  counterpartyPerson: { displayName: string };
}

export interface StateCommitment {
  id: string;
  direction: string;
  summary: string;
  status: string;
  dueAt: string | null;
  duePrecision: string;
  counterparty: string;
  // Core rule 2: a claim about the user's life is only utterable if it traces
  // to a stored Artifact, so provenance rides along with every row.
  quote: string;
  sourceArtifactId: string;
}

export interface EngineState {
  today: string;
  openCommitments: StateCommitment[];
  counts: { owedByMe: number; owedToMe: number };
}

const OPEN_STATUSES = new Set(["open", "at_risk", "overdue"]);

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildState(input: {
  now: Date;
  commitments: StateCommitmentInput[];
}): EngineState {
  const open = input.commitments.filter((c) => OPEN_STATUSES.has(c.status));

  return {
    today: isoDay(input.now),
    openCommitments: open.map((c) => ({
      id: c.id,
      direction: c.direction,
      summary: c.summary,
      status: c.status,
      dueAt: c.dueAt ? isoDay(c.dueAt) : null,
      duePrecision: c.duePrecision,
      counterparty: c.counterpartyPerson.displayName,
      quote: c.quote,
      sourceArtifactId: c.sourceArtifactId,
    })),
    counts: {
      owedByMe: open.filter((c) => c.direction === "owed_by_me").length,
      owedToMe: open.filter((c) => c.direction === "owed_to_me").length,
    },
  };
}
