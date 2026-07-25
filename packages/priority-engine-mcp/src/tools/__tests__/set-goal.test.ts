import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { setGoal } from "../set-goal";
import { createTestUser, deleteTestUser } from "./helpers";

describe("setGoal", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("creates the first goal config version when none exists", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const result = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      bucketTargets: [
        { bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 },
        { bucketKind: "pay", priorityOrder: 2, targetAmount: 6000, isFloor: false },
      ],
    });

    expect(result.versionNo).toBe(1);

    const stored = await prisma.goalConfig.findUnique({
      where: { id: result.goalConfigId },
      include: { bucketTargets: true },
    });
    expect(stored?.isCurrent).toBe(true);
    expect(stored?.bucketTargets).toHaveLength(2);
  });

  it("supersedes the prior current version when called again", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const first = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      bucketTargets: [{ bucketKind: "taxes", priorityOrder: 1, targetAmount: 4800, isFloor: true, floorAmount: 4800 }],
    });

    const second = await setGoal(prisma, {
      userId: user.id,
      effectiveFrom: "2026-08-01T00:00:00.000Z",
      bucketTargets: [{ bucketKind: "taxes", priorityOrder: 1, targetAmount: 5000, isFloor: true, floorAmount: 5000 }],
    });

    expect(second.versionNo).toBe(2);

    const priorRow = await prisma.goalConfig.findUnique({ where: { id: first.goalConfigId } });
    expect(priorRow?.isCurrent).toBe(false);

    const currentRow = await prisma.goalConfig.findFirst({ where: { userId: user.id, isCurrent: true } });
    expect(currentRow?.id).toBe(second.goalConfigId);
  });
});
