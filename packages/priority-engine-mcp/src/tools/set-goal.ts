import { z } from "zod";
import type { PrismaClient } from "../db";
import { BucketKind } from "../../../../src/generated/prisma/enums";

export const setGoalInputShape = {
  userId: z.string().uuid(),
  effectiveFrom: z.string().datetime(),
  bucketTargets: z
    .array(
      z.object({
        bucketKind: z.enum(BucketKind),
        priorityOrder: z.number().int().nonnegative(),
        targetAmount: z.number().nonnegative(),
        isFloor: z.boolean(),
        floorAmount: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
};

export interface SetGoalInput {
  userId: string;
  effectiveFrom: string;
  bucketTargets: Array<{
    bucketKind: BucketKind;
    priorityOrder: number;
    targetAmount: number;
    isFloor: boolean;
    floorAmount?: number;
  }>;
}

export async function setGoal(
  prisma: PrismaClient,
  input: SetGoalInput,
): Promise<{ goalConfigId: string; versionNo: number }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.goalConfig.findFirst({
      where: { userId: input.userId, isCurrent: true },
    });

    if (prior) {
      await tx.goalConfig.update({
        where: { id: prior.id },
        data: { isCurrent: false },
      });
    }

    const versionNo = (prior?.versionNo ?? 0) + 1;

    const created = await tx.goalConfig.create({
      data: {
        userId: input.userId,
        versionNo,
        isCurrent: true,
        effectiveFrom: new Date(input.effectiveFrom),
        bucketTargets: {
          create: input.bucketTargets.map((b) => ({
            bucketKind: b.bucketKind,
            priorityOrder: b.priorityOrder,
            targetAmount: b.targetAmount,
            isFloor: b.isFloor,
            floorAmount: b.floorAmount ?? null,
          })),
        },
      },
    });

    return { goalConfigId: created.id, versionNo: created.versionNo };
  });
}
