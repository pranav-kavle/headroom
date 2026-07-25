import { z } from "zod";
import type { PrismaClient } from "../db";

export const computeAllocationInputShape = {
  userId: z.string().uuid(),
  agentRunId: z.string().uuid(),
  triggerContext: z.unknown().optional(),
};

export interface ComputeAllocationInput {
  userId: string;
  agentRunId: string;
  triggerContext?: unknown;
}

export class NotImplementedError extends Error {}

/**
 * Stub. The waterfall this tool wraps (EPIC-11: Allocation Waterfall &
 * Safety Floors, ST-031/032/033/034) does not exist yet. Per R-001 in the
 * backlog's risk register, a wrong Safe-to-Pay number is the single most
 * damaging possible defect — so this throws rather than returning any
 * number, fabricated or otherwise.
 */
export async function computeAllocation(
  _prisma: PrismaClient,
  _input: ComputeAllocationInput,
): Promise<never> {
  throw new NotImplementedError(
    "compute_allocation is not yet implemented — depends on EPIC-11 (Allocation Waterfall & " +
      "Safety Floors, ST-031/032/033/034). See " +
      "docs/superpowers/specs/2026-07-18-priority-engine-mcp-scaffold-design.md.",
  );
}
