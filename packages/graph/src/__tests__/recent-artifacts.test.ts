import { afterEach, describe, expect, it } from "vitest";
import {
  createArtifact,
  createUser,
  listRecentArtifactsBySource,
  prisma,
  resolvePerson,
} from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_recent_artifact_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.artifact.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.identity.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.person.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("listRecentArtifactsBySource", () => {
  it("returns the newest artifacts of that source first", async () => {
    const user = await makeUser("ordering");
    for (const [suffix, day] of [
      ["oldest", "2026-08-10"],
      ["newest", "2026-08-14"],
      ["middle", "2026-08-12"],
    ]) {
      await createArtifact({
        userId: user.id,
        source: "slack",
        externalId: `C1:${suffix}`,
        occurredAt: new Date(`${day}T00:00:00.000Z`),
        excerpt: suffix,
      });
    }

    const rows = await listRecentArtifactsBySource({ userId: user.id, source: "slack", limit: 10 });

    expect(rows.map((r) => r.excerpt)).toEqual(["newest", "middle", "oldest"]);
  });

  it("honours the limit, so a chatty workspace cannot flood a turn", async () => {
    const user = await makeUser("limit");
    for (let i = 0; i < 5; i += 1) {
      await createArtifact({
        userId: user.id,
        source: "slack",
        externalId: `C1:${i}`,
        occurredAt: new Date(`2026-08-1${i}T00:00:00.000Z`),
        excerpt: `message ${i}`,
      });
    }

    const rows = await listRecentArtifactsBySource({ userId: user.id, source: "slack", limit: 2 });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.excerpt)).toEqual(["message 4", "message 3"]);
  });

  it("joins the author so a quote can be attributed without a second lookup", async () => {
    const user = await makeUser("author");
    const person = await resolvePerson({
      userId: user.id,
      kind: "slack",
      value: "U04AB",
      confidence: 1,
      displayName: "Priya Raman",
    });
    await createArtifact({
      userId: user.id,
      source: "slack",
      externalId: "C1:1723680000.1",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "can you get me the deck by Thursday",
      authorPersonId: person.id,
    });

    const [row] = await listRecentArtifactsBySource({ userId: user.id, source: "slack", limit: 10 });

    expect(row.authorPerson?.displayName).toBe("Priya Raman");
  });

  it("never reaches another user's artifacts, or another source's", async () => {
    const mine = await makeUser("scope_mine");
    const theirs = await makeUser("scope_theirs");
    await createArtifact({
      userId: theirs.id,
      source: "slack",
      externalId: "C1:theirs",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "someone else's message",
    });
    await createArtifact({
      userId: mine.id,
      source: "github",
      externalId: "PR_1",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "a pull request",
    });

    const rows = await listRecentArtifactsBySource({ userId: mine.id, source: "slack", limit: 10 });

    expect(rows).toEqual([]);
  });
});
