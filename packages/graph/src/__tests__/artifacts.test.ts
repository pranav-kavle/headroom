import { afterEach, describe, expect, it } from "vitest";
import { createArtifact, createUser, prisma } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_artifact_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.artifact.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("createArtifact", () => {
  it("round-trips a voice_note artifact", async () => {
    const user = await makeUser("roundtrip");
    const occurredAt = new Date("2026-08-12T02:00:00.000Z");

    const artifact = await createArtifact({
      userId: user.id,
      source: "voice_note",
      occurredAt,
      excerpt: "hey so I was thinking we should ship this",
    });

    expect(artifact.id).toBeTruthy();
    expect(artifact.userId).toBe(user.id);
    expect(artifact.source).toBe("voice_note");
    expect(artifact.excerpt).toBe("hey so I was thinking we should ship this");
    expect(artifact.occurredAt).toEqual(occurredAt);
    expect(artifact.externalId).toBeNull();
  });
});
