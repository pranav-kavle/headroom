import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { classifyTransaction } from "../classify-transaction";
import { createTestTransaction, createTestUser, deleteTestUser } from "./helpers";

describe("classifyTransaction", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("marks reviewState confirmed when confidence meets the threshold", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.95,
    });

    expect(result.reviewState).toBe("confirmed");
  });

  it("marks reviewState pending when confidence is below the threshold", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.4,
    });

    expect(result.reviewState).toBe("pending");
  });

  it("marks reviewState pending when no confidence is provided", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const result = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
    });

    expect(result.reviewState).toBe("pending");
  });

  it("supersedes a prior current classification for the same transaction", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const { transaction } = await createTestTransaction(prisma, user.id);

    const first = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "other",
      confidence: 0.9,
    });

    const second = await classifyTransaction(prisma, {
      transactionId: transaction.id,
      label: "income",
      confidence: 0.9,
    });

    const priorRow = await prisma.transactionClassification.findUnique({ where: { id: first.classificationId } });
    expect(priorRow?.isCurrent).toBe(false);

    const currentRow = await prisma.transactionClassification.findFirst({
      where: { transactionId: transaction.id, isCurrent: true },
    });
    expect(currentRow?.id).toBe(second.classificationId);
    expect(currentRow?.supersedesId).toBe(first.classificationId);
  });
});
