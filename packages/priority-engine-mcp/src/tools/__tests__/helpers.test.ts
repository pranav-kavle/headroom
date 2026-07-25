import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import {
  createTestPlanFixture,
  createTestTransaction,
  createTestUser,
  deleteTestUser,
} from "./helpers";

describe("test fixtures", () => {
  it("creates and fully deletes a test user", async () => {
    const user = await createTestUser(prisma);
    expect(user.id).toBeDefined();

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).not.toBeNull();

    await deleteTestUser(prisma, user.id);

    const goneCheck = await prisma.user.findUnique({ where: { id: user.id } });
    expect(goneCheck).toBeNull();
  });

  it("creates a transaction fixture and fully deletes it via deleteTestUser", async () => {
    const user = await createTestUser(prisma);

    const { connection, account, transaction } = await createTestTransaction(prisma, user.id);

    expect(connection.userId).toBe(user.id);
    expect(account.connectionId).toBe(connection.id);
    expect(transaction.accountId).toBe(account.id);

    await deleteTestUser(prisma, user.id);

    const [connectionGone, accountGone, transactionGone] = await Promise.all([
      prisma.bankConnection.findUnique({ where: { id: connection.id } }),
      prisma.bankAccount.findUnique({ where: { id: account.id } }),
      prisma.transaction.findUnique({ where: { id: transaction.id } }),
    ]);

    expect(connectionGone).toBeNull();
    expect(accountGone).toBeNull();
    expect(transactionGone).toBeNull();
  });

  it("creates a plan fixture and fully deletes it via deleteTestUser", async () => {
    const user = await createTestUser(prisma);

    const { goalConfig, taxProfile, triggerEvent, agentRun, plan } = await createTestPlanFixture(
      prisma,
      user.id,
    );

    expect(goalConfig.userId).toBe(user.id);
    expect(taxProfile.userId).toBe(user.id);
    expect(triggerEvent.userId).toBe(user.id);
    expect(agentRun.userId).toBe(user.id);
    expect(agentRun.triggerEventId).toBe(triggerEvent.id);
    expect(plan.userId).toBe(user.id);
    expect(plan.agentRunId).toBe(agentRun.id);
    expect(plan.goalConfigId).toBe(goalConfig.id);
    expect(plan.taxProfileId).toBe(taxProfile.id);
    expect(plan.promisedNumber.toNumber()).toBe(3650);

    await deleteTestUser(prisma, user.id);

    const [planGone, goalConfigGone, taxProfileGone, triggerEventGone, agentRunGone] =
      await Promise.all([
        prisma.plan.findUnique({ where: { id: plan.id } }),
        prisma.goalConfig.findUnique({ where: { id: goalConfig.id } }),
        prisma.taxProfile.findUnique({ where: { id: taxProfile.id } }),
        prisma.triggerEvent.findUnique({ where: { id: triggerEvent.id } }),
        prisma.agentRun.findUnique({ where: { id: agentRun.id } }),
      ]);

    expect(planGone).toBeNull();
    expect(goalConfigGone).toBeNull();
    expect(taxProfileGone).toBeNull();
    expect(triggerEventGone).toBeNull();
    expect(agentRunGone).toBeNull();
  });

  it("deletes a user with both transaction and plan fixtures across every table deleteTestUser touches", async () => {
    const user = await createTestUser(prisma);

    const { connection, account, transaction } = await createTestTransaction(prisma, user.id);
    const { goalConfig, taxProfile, triggerEvent, agentRun, plan } = await createTestPlanFixture(
      prisma,
      user.id,
    );
    const bucketTargets = await prisma.bucketTarget.findMany({
      where: { goalConfigId: goalConfig.id },
    });
    expect(bucketTargets.length).toBeGreaterThan(0);

    await deleteTestUser(prisma, user.id);

    const results = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.bankConnection.findUnique({ where: { id: connection.id } }),
      prisma.bankAccount.findUnique({ where: { id: account.id } }),
      prisma.transaction.findUnique({ where: { id: transaction.id } }),
      prisma.goalConfig.findUnique({ where: { id: goalConfig.id } }),
      prisma.bucketTarget.findMany({ where: { goalConfigId: goalConfig.id } }),
      prisma.taxProfile.findUnique({ where: { id: taxProfile.id } }),
      prisma.triggerEvent.findUnique({ where: { id: triggerEvent.id } }),
      prisma.agentRun.findUnique({ where: { id: agentRun.id } }),
      prisma.plan.findUnique({ where: { id: plan.id } }),
    ]);

    for (const result of results) {
      expect(result === null || (Array.isArray(result) && result.length === 0)).toBe(true);
    }
  });
});
