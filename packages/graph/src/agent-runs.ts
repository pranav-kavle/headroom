// A turn, recorded as the orchestration rows §5 always specified: a
// TriggerEvent (what woke the agent) and an AgentRun (what it then did).
//
// These existed in the schema and nothing ever wrote them, which is why the
// Ledger has always been empty — an Action requires an agentRunId, so with no
// run there could be no action, and with no action there was nothing to show.

import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { AgentRun, Prisma, TriggerType } from "./generated/prisma/client";

/**
 * Opens a run for one conversational turn.
 *
 * The turn id doubles as the trigger's idempotency key: it is already unique
 * per turn, and it means a retried turn cannot open a second run.
 */
export async function startAgentRun(input: {
  userId: string;
  turnId: string;
  triggerType?: TriggerType;
  payload?: Record<string, unknown>;
  at: Date;
}): Promise<AgentRun> {
  const triggerEvent = await prisma.triggerEvent.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      triggerType: input.triggerType ?? "manual_feedback",
      payload: (input.payload ?? {}) as Prisma.InputJsonObject,
      idempotencyKey: `turn:${input.turnId}`,
      receivedAt: input.at,
    },
  });

  return prisma.agentRun.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      triggerEventId: triggerEvent.id,
      status: "running",
      startedAt: input.at,
    },
  });
}

export function finishAgentRun(input: {
  id: string;
  status: "ok" | "error";
  at: Date;
}): Promise<AgentRun> {
  return prisma.agentRun.update({
    where: { id: input.id },
    data: { status: input.status, finishedAt: input.at },
  });
}
