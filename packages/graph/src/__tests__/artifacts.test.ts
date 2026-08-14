import { afterEach, describe, expect, it } from "vitest";
import { createArtifact, createUser, findArtifactBySourceExternalId, prisma } from "../index";

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

describe("findArtifactBySourceExternalId", () => {
  it("finds an artifact created with a matching source and external id", async () => {
    const user = await makeUser("find_by_external_id");
    const created = await createArtifact({
      userId: user.id,
      source: "github",
      externalId: "PR_kwDOAbc123",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "Fix the thing",
      url: "https://github.com/acme/repo/pull/1",
    });

    const found = await findArtifactBySourceExternalId(user.id, "github", "PR_kwDOAbc123");

    expect(found?.id).toBe(created.id);
  });

  it("returns null when nothing matches", async () => {
    const user = await makeUser("find_by_external_id_miss");

    expect(await findArtifactBySourceExternalId(user.id, "github", "does-not-exist")).toBeNull();
  });
});
