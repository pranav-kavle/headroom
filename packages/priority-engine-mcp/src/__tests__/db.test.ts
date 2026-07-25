import { describe, expect, it } from "vitest";
import { prisma } from "../db";

describe("prisma singleton", () => {
  it("connects to the database", async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });
});
