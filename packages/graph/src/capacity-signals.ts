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
