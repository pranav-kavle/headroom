import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../db";

export async function createTestUser(prisma: PrismaClient) {
  return prisma.user.create({
    data: {
      clerkUserId: `test_${randomUUID()}`,
      email: `test-${randomUUID()}@example.com`,
      v1Eligibility: "schedule_c_supported",
    },
  });
}

export async function createTestTransaction(prisma: PrismaClient, userId: string) {
  const connection = await prisma.bankConnection.create({
    data: {
      userId,
      provider: "plaid",
      providerItemId: `test-item-${randomUUID()}`,
      status: "active",
      encryptedAccessToken: "test-encrypted",
      accessTokenIv: "test-iv",
      accessTokenAuthTag: "test-auth-tag",
    },
  });

  const account = await prisma.bankAccount.create({
    data: {
      connectionId: connection.id,
      providerAccountId: `test-account-${randomUUID()}`,
      type: "checking",
      isCommingled: false,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      accountId: account.id,
      providerTxnId: `test-txn-${randomUUID()}`,
      postedDate: new Date("2026-07-15"),
      amount: 5000,
      rawDescription: "Test deposit",
    },
  });

  return { connection, account, transaction };
}

export async function createTestPlanFixture(prisma: PrismaClient, userId: string) {
  const goalConfig = await prisma.goalConfig.create({
    data: {
      userId,
      versionNo: 1,
      isCurrent: true,
      effectiveFrom: new Date("2026-07-01"),
      bucketTargets: {
        create: [
          { bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 },
          { bucketKind: "runway", priorityOrder: 2, targetAmount: 6000, isFloor: true, floorAmount: 6000 },
          { bucketKind: "pay", priorityOrder: 3, targetAmount: 6000, isFloor: false, floorAmount: null },
        ],
      },
    },
  });

  const taxProfile = await prisma.taxProfile.create({
    data: {
      userId,
      versionNo: 1,
      isCurrent: true,
      taxYear: 2026,
      filingStatus: "single",
      taxTreatment: "schedule_c",
      residentTaxJurisdiction: "CA",
      effectiveFrom: new Date("2026-07-01"),
    },
  });

  const triggerEvent = await prisma.triggerEvent.create({
    data: {
      userId,
      triggerType: "manual_feedback",
      payload: {},
      idempotencyKey: `test-trigger-${randomUUID()}`,
    },
  });

  const agentRun = await prisma.agentRun.create({
    data: {
      userId,
      triggerEventId: triggerEvent.id,
      status: "ok",
    },
  });

  const plan = await prisma.plan.create({
    data: {
      userId,
      agentRunId: agentRun.id,
      goalConfigId: goalConfig.id,
      taxProfileId: taxProfile.id,
      runType: "synthesize",
      planStatus: "final",
      inputFreshnessStatus: "fresh",
      engineVersion: "0.1.0",
      engineBuildSha: "test-sha",
      safeToPayLow: 3650,
      safeToPayHigh: 5050,
      promisedNumber: 3650,
      taxBombStatus: "gap",
      appliedForecastParams: {},
      assumptions: {},
      inputDigest: "test-input-digest",
      inputDigestAlgo: "sha256",
      inputDigestSpecVersion: "v1",
      outputDigest: "test-output-digest",
      outputDigestAlgo: "sha256",
      outputDigestSpecVersion: "v1",
    },
  });

  return { goalConfig, taxProfile, triggerEvent, agentRun, plan };
}

export async function deleteTestUser(prisma: PrismaClient, userId: string) {
  await prisma.$transaction([
    prisma.recommendationOutcome.deleteMany({ where: { plan: { userId } } }),
    prisma.checkIn.deleteMany({ where: { plan: { userId } } }),
    prisma.planWarning.deleteMany({ where: { plan: { userId } } }),
    prisma.allocationLine.deleteMany({ where: { plan: { userId } } }),
    prisma.projection.deleteMany({ where: { plan: { userId } } }),
    prisma.plan.deleteMany({ where: { userId } }),
    prisma.agentRun.deleteMany({ where: { userId } }),
    prisma.triggerEvent.deleteMany({ where: { userId } }),
    prisma.transactionClassification.deleteMany({
      where: { transaction: { account: { connection: { userId } } } },
    }),
    prisma.transaction.deleteMany({
      where: { account: { connection: { userId } } },
    }),
    prisma.accountBalanceSnapshot.deleteMany({
      where: { account: { connection: { userId } } },
    }),
    prisma.bankAccount.deleteMany({ where: { connection: { userId } } }),
    prisma.bankConnection.deleteMany({ where: { userId } }),
    prisma.bucketTarget.deleteMany({ where: { goalConfig: { userId } } }),
    prisma.goalConfig.deleteMany({ where: { userId } }),
    prisma.taxProfile.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
