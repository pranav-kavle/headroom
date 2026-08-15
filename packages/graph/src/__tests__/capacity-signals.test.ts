import { afterEach, describe, expect, it } from "vitest";
import { createArtifact, createUser, prisma, upsertCapacitySignal } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_capacity_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.capacitySignal.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.artifact.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("upsertCapacitySignal", () => {
  it("creates a signal citing its source artifact", async () => {
    const user = await makeUser("create");
    const artifact = await createArtifact({
      userId: user.id,
      source: "google_health",
      occurredAt: new Date("2026-08-13T00:00:00.000Z"),
      excerpt: "7h 12m sleep",
    });

    const signal = await upsertCapacitySignal({
      userId: user.id,
      kind: "sleep",
      value: 7.2,
      unit: "hours",
      forDate: new Date("2026-08-13T00:00:00.000Z"),
      sourceArtifactId: artifact.id,
    });

    expect(signal.userId).toBe(user.id);
    expect(signal.kind).toBe("sleep");
    expect(signal.unit).toBe("hours");
    expect(signal.value.toNumber()).toBe(7.2);
    expect(signal.sourceArtifactId).toBe(artifact.id);
  });

  it("upserts on a repeat sync for the same user/kind/day", async () => {
    const user = await makeUser("upsert");
    const artifactDay1 = await createArtifact({
      userId: user.id,
      source: "google_health",
      occurredAt: new Date("2026-08-13T00:00:00.000Z"),
      excerpt: "58 bpm resting",
    });
    const artifactDay1Revised = await createArtifact({
      userId: user.id,
      source: "google_health",
      externalId: "rhr:2026-08-13:revised",
      occurredAt: new Date("2026-08-13T00:00:00.000Z"),
      excerpt: "56 bpm resting",
    });

    await upsertCapacitySignal({
      userId: user.id,
      kind: "rhr",
      value: 58,
      unit: "bpm",
      forDate: new Date("2026-08-13T00:00:00.000Z"),
      sourceArtifactId: artifactDay1.id,
    });

    const resynced = await upsertCapacitySignal({
      userId: user.id,
      kind: "rhr",
      value: 56,
      unit: "bpm",
      forDate: new Date("2026-08-13T00:00:00.000Z"),
      sourceArtifactId: artifactDay1Revised.id,
    });

    const rows = await prisma.capacitySignal.findMany({ where: { userId: user.id, kind: "rhr" } });
    expect(rows).toHaveLength(1);
    expect(resynced.value.toNumber()).toBe(56);
    expect(resynced.sourceArtifactId).toBe(artifactDay1Revised.id);
  });
});
