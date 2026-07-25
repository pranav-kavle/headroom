import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { computeAllocation } from "../compute-allocation";

describe("computeAllocation", () => {
  it("throws a not-implemented error rather than fabricating a number", async () => {
    await expect(
      computeAllocation(prisma, {
        userId: "00000000-0000-0000-0000-000000000000",
        agentRunId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/not yet implemented.*EPIC-11/s);
  });
});
