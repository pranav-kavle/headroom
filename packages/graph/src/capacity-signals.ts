import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { CapacitySignalKind, Prisma } from "./generated/prisma/client";

export type CapacitySignalRow = {
  id: string;
  userId: string;
  kind: CapacitySignalKind;
  value: Prisma.Decimal;
  unit: string;
  forDate: Date;
  sourceArtifactId: string;
};

// The read side deliberately does NOT reuse CapacitySignalRow: that type
// carries a Prisma.Decimal, and port rule 6 keeps Prisma inside this package.
// Callers get a plain number, converted here.
export type CapacityReadingRow = {
  kind: CapacitySignalKind;
  value: number;
  unit: string;
  forDate: Date;
  sourceArtifactId: string;
};

// Oldest-first: these feed a sparkline, which reads left to right in time.
export function listRecentCapacitySignals(input: {
  userId: string;
  kinds: CapacitySignalKind[];
  since: Date;
}): Promise<CapacityReadingRow[]> {
  return prisma.capacitySignal
    .findMany({
      where: { userId: input.userId, kind: { in: input.kinds }, forDate: { gte: input.since } },
      orderBy: [{ forDate: "asc" }],
    })
    .then((rows) =>
      rows.map((row) => ({
        kind: row.kind,
        value: row.value.toNumber(),
        unit: row.unit,
        forDate: row.forDate,
        sourceArtifactId: row.sourceArtifactId,
      })),
    );
}

export function upsertCapacitySignal(input: {
  userId: string;
  kind: CapacitySignalKind;
  value: number;
  unit: string;
  forDate: Date;
  sourceArtifactId: string;
}): Promise<CapacitySignalRow> {
  const { userId, kind, forDate, ...rest } = input;
  return prisma.capacitySignal.upsert({
    where: { userId_kind_forDate: { userId, kind, forDate } },
    create: { id: randomUUID(), userId, kind, forDate, ...rest },
    update: { ...rest },
  });
}
