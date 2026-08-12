import { afterEach, describe, expect, it } from "vitest";
import { createUser, listActions, prisma } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_action_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

async function makeAgentRun(userId: string, startedAt: Date) {
  const triggerEvent = await prisma.triggerEvent.create({
    data: {
      userId,
      triggerType: "schedule",
      payload: {},
      idempotencyKey: `idem_${userId}_${startedAt.getTime()}`,
    },
  });
  return prisma.agentRun.create({
    data: { userId, triggerEventId: triggerEvent.id, status: "ok", startedAt },
  });
}

async function makeAction(input: {
  userId: string;
  agentRunId: string;
  kind: string;
  status?: "proposed" | "executed" | "approved" | "undone" | "failed";
  executedAt?: Date;
}) {
  return prisma.action.create({
    data: {
      userId: input.userId,
      tier: "tier_1",
      kind: input.kind,
      status: input.status ?? "executed",
      payload: {},
      executedAt: input.executedAt,
      agentRunId: input.agentRunId,
    },
  });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.action.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.agentRun.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.triggerEvent.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("listActions", () => {
  it("returns only the calling user's actions, with the agent run included", async () => {
    const owner = await makeUser("list-owner");
    const other = await makeUser("list-other");
    const ownerRun = await makeAgentRun(owner.id, new Date("2026-08-12T07:02:00.000Z"));
    const otherRun = await makeAgentRun(other.id, new Date("2026-08-12T07:02:00.000Z"));
    await makeAction({ userId: owner.id, agentRunId: ownerRun.id, kind: "draft_reply" });
    await makeAction({ userId: other.id, agentRunId: otherRun.id, kind: "draft_reply" });

    const actions = await listActions(owner.id);

    expect(actions).toHaveLength(1);
    expect(actions[0].userId).toBe(owner.id);
    expect(actions[0].agentRun.startedAt).toEqual(ownerRun.startedAt);
  });

  it("returns an empty array when the user has no actions", async () => {
    const user = await makeUser("list-empty");

    expect(await listActions(user.id)).toEqual([]);
  });

  it("orders by executedAt, falling back to the agent run's startedAt, newest first", async () => {
    const user = await makeUser("list-order");
    const earlyRun = await makeAgentRun(user.id, new Date("2026-08-12T07:00:00.000Z"));
    const lateRun = await makeAgentRun(user.id, new Date("2026-08-12T08:00:00.000Z"));

    const executedEarly = await makeAction({
      userId: user.id,
      agentRunId: earlyRun.id,
      kind: "draft_reply",
      executedAt: new Date("2026-08-12T07:02:00.000Z"),
    });
    const executedLate = await makeAction({
      userId: user.id,
      agentRunId: earlyRun.id,
      kind: "calendar_hold",
      executedAt: new Date("2026-08-12T09:00:00.000Z"),
    });
    const proposedNoExecutedAt = await makeAction({
      userId: user.id,
      agentRunId: lateRun.id,
      kind: "review_pr",
      status: "proposed",
    });

    const actions = await listActions(user.id);

    expect(actions.map((a) => a.id)).toEqual([executedLate.id, proposedNoExecutedAt.id, executedEarly.id]);
  });
});
