import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { getState } from "../get-state";
import { createTestPlanFixture, createTestUser, deleteTestUser } from "./helpers";

describe("getState", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("returns null/empty sections for a user with no config or plan yet", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const result = await getState(prisma, { userId: user.id });

    expect(result).toEqual({
      goalConfig: null,
      taxProfile: null,
      balances: [],
      latestPlan: null,
    });
  });

  it("returns the current goal config, tax profile, and latest plan", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const fixture = await createTestPlanFixture(prisma, user.id);

    const result = await getState(prisma, { userId: user.id });

    expect(result.goalConfig).toMatchObject({
      id: fixture.goalConfig.id,
      versionNo: 1,
      bucketTargets: expect.arrayContaining([
        expect.objectContaining({ bucketKind: "taxes", targetAmount: "4800" }),
      ]),
    });
    expect(result.taxProfile).toMatchObject({
      id: fixture.taxProfile.id,
      filingStatus: "single",
      residentTaxJurisdiction: "CA",
    });
    expect(result.latestPlan).toMatchObject({
      id: fixture.plan.id,
      promisedNumber: "3650",
      taxBombStatus: "gap",
    });
  });

  it("ignores a superseded goal config version", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;

    const v1 = await prisma.goalConfig.create({
      data: { userId: user.id, versionNo: 1, isCurrent: false, effectiveFrom: new Date("2026-01-01") },
    });
    const v2 = await prisma.goalConfig.create({
      data: { userId: user.id, versionNo: 2, isCurrent: true, effectiveFrom: new Date("2026-07-01") },
    });

    const result = await getState(prisma, { userId: user.id });

    expect(result.goalConfig?.id).toBe(v2.id);
    expect(result.goalConfig?.id).not.toBe(v1.id);
  });
});
