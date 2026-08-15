import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { Action, ActionTier, AgentRun, Prisma } from "./generated/prisma/client";

export type ActionRow = Action & { agentRun: Pick<AgentRun, "startedAt"> };

export async function listActions(userId: string): Promise<ActionRow[]> {
  const actions = await prisma.action.findMany({
    where: { userId },
    include: { agentRun: { select: { startedAt: true } } },
  });

  return actions.sort((a, b) => sortTime(b).getTime() - sortTime(a).getTime());
}

function sortTime(action: ActionRow): Date {
  return action.executedAt ?? action.agentRun.startedAt;
}

/**
 * Records an outward-facing action the policy gate held back.
 *
 * This is the offer, made durable. Before it existed a blocked call lived only
 * in the turn's memory, so "I've queued that for you" described nothing at all
 * — there was no queue, and the user's "go ahead" had nowhere to land.
 */
export function createProposedAction(input: {
  userId: string;
  agentRunId: string;
  tier: ActionTier;
  kind: string;
  payload: Record<string, unknown>;
}): Promise<Action> {
  return prisma.action.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      agentRunId: input.agentRunId,
      tier: input.tier,
      kind: input.kind,
      status: "proposed",
      // The caller's plain object, narrowed to Prisma's JSON input type here
      // rather than leaking that type into every caller's signature.
      payload: input.payload as Prisma.InputJsonObject,
    },
  });
}

/**
 * Finds an outstanding offer that this call is the user's confirmation of.
 *
 * Two conditions carry the whole safety argument:
 *
 * - The payload must match **exactly**. Approval attaches to the specific text
 *   the user was read, not to the action's name — so a re-request with edited
 *   wording finds nothing here and becomes a fresh offer.
 * - The proposal must come from an **earlier run**. Within a single turn the
 *   model could otherwise propose and then immediately consume its own offer,
 *   which is the one shape that would let it manufacture consent.
 * - The proposal must be **recent**. An offer the user talked past half an
 *   hour ago is not consent to run it now, and without a window a declined
 *   offer would sit `proposed` forever, waiting to be matched by an
 *   unrelated later call with the same arguments.
 */
export function findApprovableAction(input: {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
  excludeAgentRunId: string;
  proposedAfter: Date;
}): Promise<Action | null> {
  return prisma.action.findFirst({
    where: {
      userId: input.userId,
      kind: input.kind,
      status: "proposed",
      payload: { equals: input.payload as Prisma.InputJsonObject },
      agentRunId: { not: input.excludeAgentRunId },
      agentRun: { startedAt: { gte: input.proposedAfter } },
    },
    orderBy: { agentRun: { startedAt: "desc" } },
  });
}

export function markActionExecuted(input: {
  id: string;
  externalRef?: string;
  at: Date;
}): Promise<Action> {
  return prisma.action.update({
    where: { id: input.id },
    data: { status: "executed", executedAt: input.at, externalRef: input.externalRef },
  });
}

export function markActionFailed(id: string): Promise<Action> {
  return prisma.action.update({ where: { id }, data: { status: "failed" } });
}
