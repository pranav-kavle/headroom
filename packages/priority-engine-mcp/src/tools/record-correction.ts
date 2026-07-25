import { z } from "zod";
import type { PrismaClient } from "../db";
import { ClassificationCadence, ClassificationLabel } from "../../../../src/generated/prisma/enums";

export const recordCorrectionInputShape = {
  classificationId: z.string().uuid(),
  label: z.enum(ClassificationLabel),
  cadence: z.enum(ClassificationCadence).optional(),
  checkInId: z.string().uuid().optional(),
};

export interface RecordCorrectionInput {
  classificationId: string;
  label: ClassificationLabel;
  cadence?: ClassificationCadence;
  checkInId?: string;
}

export async function recordCorrection(
  prisma: PrismaClient,
  input: RecordCorrectionInput,
): Promise<{ classificationId: string }> {
  return prisma.$transaction(async (tx) => {
    const prior = await tx.transactionClassification.findUniqueOrThrow({
      where: { id: input.classificationId },
    });

    await tx.transactionClassification.update({
      where: { id: prior.id },
      data: { isCurrent: false },
    });

    const created = await tx.transactionClassification.create({
      data: {
        transactionId: prior.transactionId,
        source: "user",
        label: input.label,
        cadence: input.cadence,
        reviewState: "corrected",
        supersedesId: prior.id,
        isCurrent: true,
      },
    });

    if (input.checkInId) {
      await tx.checkIn.update({
        where: { id: input.checkInId },
        data: { resultingClassificationId: created.id },
      });
    }

    return { classificationId: created.id };
  });
}
