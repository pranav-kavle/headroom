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
 * - The proposal must come from a **different utterance**. A different run was
 *   assumed to mean the user had spoken again, and it does not: Deepgram sends
 *   `/agent/think` more than one request for a single utterance, and each gets
 *   its own turn id, its own run, and its own identical tool call. The second
 *   one then matched the first one's proposal and executed — so "close PR 90"
 *   closed PR 90 on the asking turn, a second before the offer was even spoken.
 *   By the time the user said "yeah", the PR was gone, and the agent truthfully
 *   reported it could not find it. Comparing the words behind the run is what
 *   separates the user saying something new from the same words arriving twice.
 * - The proposal must be **recent**. An offer the user talked past half an
 *   hour ago is not consent to run it now, and without a window a declined
 *   offer would sit `proposed` forever, waiting to be matched by an
 *   unrelated later call with the same arguments.
 */
export async function findApprovableAction(input: {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
  excludeAgentRunId: string;
  proposedAfter: Date;
  // What the user actually said on the call now asking to execute. A proposal
  // made under these same words is this request's own duplicate, never its
  // confirmation.
  utterance: string;
}): Promise<Action | null> {
  const candidates = await prisma.action.findMany({
    where: {
      userId: input.userId,
      kind: input.kind,
      status: "proposed",
      payload: { equals: input.payload as Prisma.InputJsonObject },
      agentRunId: { not: input.excludeAgentRunId },
      agentRun: { startedAt: { gte: input.proposedAfter } },
    },
    orderBy: { agentRun: { startedAt: "desc" } },
    // The transcript that opened the proposing run. Read through the relation
    // rather than copied onto the Action: the TriggerEvent already is the
    // record of what the user said, and duplicating it would give two places
    // to disagree about the same utterance.
    include: { agentRun: { select: { triggerEvent: { select: { payload: true } } } } },
  });

  // Filtered here rather than in the query. Prisma's JSON `not` treats a
  // missing key and a stored null as the same absent thing, so a run whose
  // payload carries no transcript would silently drop out of the candidate
  // set — turning an unmatchable proposal into an invisible one. Comparing in
  // TypeScript keeps "no transcript recorded" distinguishable, and these sets
  // are single digits.
  const approvable = candidates.find((action) => {
    const payload = action.agentRun.triggerEvent.payload as { transcript?: unknown } | null;
    const proposedUnder = typeof payload?.transcript === "string" ? payload.transcript : null;
    // Unknown provenance is not consent: without the words behind the proposal
    // there is no way to tell a fresh confirmation from a duplicate request.
    if (proposedUnder === null) return false;
    return proposedUnder !== input.utterance;
  });

  return approvable ?? null;
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
