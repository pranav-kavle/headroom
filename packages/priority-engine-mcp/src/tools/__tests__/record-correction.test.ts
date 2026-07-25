import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { classifyTransaction } from "../classify-transaction";
import { recordCorrection } from "../record-correction";
import { createTestPlanFixture, createTestTransaction, createTestUser, deleteTestUser } from "./helpers";

describe("recordCorrection", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("creates a corrected classification and supersedes the prior one", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const corrected = await recordCorrection(prisma, {
      classificationId: original.classificationId,
      label: "income",
    });

    const priorRow = await prisma.transactionClassification.findUnique({
      where: { id: original.classificationId },
    });
    expect(priorRow?.isCurrent).toBe(false);

    const newRow = await prisma.transactionClassification.findUnique({
      where: { id: corrected.classificationId },
    });
    expect(newRow?.source).toBe("user");
    expect(newRow?.reviewState).toBe("corrected");
    expect(newRow?.supersedesId).toBe(original.classificationId);
    expect(newRow?.label).toBe("income");
  });

  it("links a CheckIn's resultingClassificationId when checkInId is provided", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const fixture = await createTestPlanFixture(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const checkIn = await prisma.checkIn.create({
      data: {
        planId: fixture.plan.id,
        agentRunId: fixture.agentRun.id,
        decisionText: "Is this Acme payment income?",
        channel: "ui",
      },
    });

    const corrected = await recordCorrection(prisma, {
      classificationId: original.classificationId,
      label: "income",
      checkInId: checkIn.id,
    });

    const updatedCheckIn = await prisma.checkIn.findUnique({ where: { id: checkIn.id } });
    expect(updatedCheckIn?.resultingClassificationId).toBe(corrected.classificationId);
  });

  it("prevents two concurrent corrections from both becoming current", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);
    const original = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.4,
    });

    const results = await Promise.allSettled([
      recordCorrection(prisma, { classificationId: original.classificationId, label: "income" }),
      recordCorrection(prisma, { classificationId: original.classificationId, label: "transfer" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const currentRows = await prisma.transactionClassification.findMany({
      where: { transactionId: transaction.id, isCurrent: true },
    });
    expect(currentRows).toHaveLength(1);
  });
});
