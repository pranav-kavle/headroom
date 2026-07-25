import { describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { getProjections } from "../get-projections";

describe("getProjections", () => {
  it("throws a not-implemented error rather than returning fabricated projections", async () => {
    await expect(
      getProjections(prisma, { userId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(/not yet implemented.*EPIC-12/s);
  });
});
