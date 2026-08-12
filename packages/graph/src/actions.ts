import { prisma } from "./client";
import type { Action, AgentRun } from "./generated/prisma/client";

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
