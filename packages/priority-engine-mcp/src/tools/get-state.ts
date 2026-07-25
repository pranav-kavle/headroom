import { z } from "zod";
import type { PrismaClient } from "../db";

export const getStateInputShape = {
  userId: z.string().uuid(),
};

export interface GetStateInput {
  userId: string;
}

export interface GetStateResult {
  goalConfig: {
    id: string;
    versionNo: number;
    effectiveFrom: string;
    bucketTargets: Array<{
      bucketKind: string;
      priorityOrder: number;
      targetAmount: string;
      isFloor: boolean;
      floorAmount: string | null;
    }>;
  } | null;
  taxProfile: {
    id: string;
    versionNo: number;
    taxYear: number;
    filingStatus: string;
    taxTreatment: string;
    residentTaxJurisdiction: string;
    effectiveFrom: string;
  } | null;
  balances: Array<{
    accountId: string;
    balance: string;
    asOf: string;
    source: string;
  }>;
  latestPlan: {
    id: string;
    planStatus: string;
    safeToPayLow: string;
    safeToPayHigh: string;
    promisedNumber: string;
    taxBombStatus: string;
    createdAt: string;
  } | null;
}

export async function getState(prisma: PrismaClient, input: GetStateInput): Promise<GetStateResult> {
  const [goalConfig, taxProfile, accounts, latestPlan] = await Promise.all([
    prisma.goalConfig.findFirst({
      where: { userId: input.userId, isCurrent: true },
      include: { bucketTargets: true },
    }),
    prisma.taxProfile.findFirst({
      where: { userId: input.userId, isCurrent: true },
    }),
    prisma.bankAccount.findMany({
      where: { connection: { userId: input.userId } },
      include: { balanceSnapshots: { orderBy: { asOf: "desc" }, take: 1 } },
    }),
    prisma.plan.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    goalConfig: goalConfig
      ? {
          id: goalConfig.id,
          versionNo: goalConfig.versionNo,
          effectiveFrom: goalConfig.effectiveFrom.toISOString(),
          bucketTargets: goalConfig.bucketTargets.map((b) => ({
            bucketKind: b.bucketKind,
            priorityOrder: b.priorityOrder,
            targetAmount: b.targetAmount.toString(),
            isFloor: b.isFloor,
            floorAmount: b.floorAmount?.toString() ?? null,
          })),
        }
      : null,
    taxProfile: taxProfile
      ? {
          id: taxProfile.id,
          versionNo: taxProfile.versionNo,
          taxYear: taxProfile.taxYear,
          filingStatus: taxProfile.filingStatus,
          taxTreatment: taxProfile.taxTreatment,
          residentTaxJurisdiction: taxProfile.residentTaxJurisdiction,
          effectiveFrom: taxProfile.effectiveFrom.toISOString(),
        }
      : null,
    balances: accounts
      .filter((a) => a.balanceSnapshots.length > 0)
      .map((a) => ({
        accountId: a.id,
        balance: a.balanceSnapshots[0].balance.toString(),
        asOf: a.balanceSnapshots[0].asOf.toISOString(),
        source: a.balanceSnapshots[0].source,
      })),
    latestPlan: latestPlan
      ? {
          id: latestPlan.id,
          planStatus: latestPlan.planStatus,
          safeToPayLow: latestPlan.safeToPayLow.toString(),
          safeToPayHigh: latestPlan.safeToPayHigh.toString(),
          promisedNumber: latestPlan.promisedNumber.toString(),
          taxBombStatus: latestPlan.taxBombStatus,
          createdAt: latestPlan.createdAt.toISOString(),
        }
      : null,
  };
}
