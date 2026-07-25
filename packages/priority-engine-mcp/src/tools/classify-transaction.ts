import { z } from "zod";
import type { PrismaClient } from "../db";
import { ClassificationCadence, ClassificationLabel } from "../../../../src/generated/prisma/enums";

// Provisional — the real value is an open decision pending the Sprint-0 spike.
// See docs/analysis/pass-2-solution-definition.md §7 and
// docs/analysis/pass-4-implementation-review.md §8.
export const CONFIDENCE_THRESHOLD = 0.8;

export const classifyTransactionInputShape = {
  transactionId: z.string().uuid(),
  label: z.enum(ClassificationLabel),
  cadence: z.enum(ClassificationCadence).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.unknown().optional(),
};

export interface ClassifyTransactionInput {
  transactionId: string;
  label: ClassificationLabel;
  cadence?: ClassificationCadence;
  confidence?: number;
  evidence?: unknown;
}

export async function classifyTransaction(
  prisma: PrismaClient,
  input: ClassifyTransactionInput,
): Promise<{ classificationId: string; reviewState: string }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.transactionClassification.findFirst({
      where: { transactionId: input.transactionId, isCurrent: true },
    });

    if (prior) {
      await tx.transactionClassification.update({
        where: { id: prior.id },
        data: { isCurrent: false },
      });
    }

    // Bias to ask (BRULE-005): confirmed only when confidence explicitly
    // meets the threshold. Missing or low confidence always falls back to
    // pending — never silently confirmed.
    const reviewState =
      input.confidence !== undefined && input.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "pending";

    const created = await tx.transactionClassification.create({
      data: {
        transactionId: input.transactionId,
        source: "model",
        label: input.label,
        cadence: input.cadence,
        confidence: input.confidence,
        evidence: input.evidence === undefined ? undefined : (input.evidence as object),
        reviewState,
        supersedesId: prior?.id,
        isCurrent: true,
      },
    });

    return { classificationId: created.id, reviewState: created.reviewState };
  });
}
