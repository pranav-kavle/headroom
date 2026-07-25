import { z } from "zod";
import type { PrismaClient } from "../db";
import { NotImplementedError } from "./compute-allocation";

export const getProjectionsInputShape = {
  userId: z.string().uuid(),
  planId: z.string().uuid().optional(),
};

export interface GetProjectionsInput {
  userId: string;
  planId?: string;
}

/**
 * Stub. The forecasting this tool wraps (EPIC-12: Income & Spend
 * Forecasting, ST-036) does not exist yet — see compute-allocation.ts for
 * why this throws instead of returning placeholder projections.
 */
export async function getProjections(
  _prisma: PrismaClient,
  _input: GetProjectionsInput,
): Promise<never> {
  throw new NotImplementedError(
    "get_projections is not yet implemented — depends on EPIC-12 (Income & Spend Forecasting, " +
      "ST-036). See docs/superpowers/specs/2026-07-18-priority-engine-mcp-scaffold-design.md.",
  );
}
