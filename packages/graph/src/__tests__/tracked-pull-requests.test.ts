import { afterEach, describe, expect, it } from "vitest";
import {
  closeTrackedPullRequest,
  closeTrackedPullRequestIfPresent,
  createArtifact,
  createCommitment,
  createUser,
  listOpenPullRequestsWithoutCommitment,
  listOpenTrackedPullRequests,
  prisma,
  upsertTrackedPullRequest,
} from "../index";

const clerkIds: string[] = [];
const SEEN = new Date("2026-08-15T00:00:00.000Z");

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_tracked_pr_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

async function makePR(userId: string, nodeId: string, number: number) {
  const artifact = await createArtifact({
    userId,
    source: "github",
    externalId: nodeId,
    occurredAt: SEEN,
    excerpt: `PR ${number}`,
    url: `https://github.com/acme/repo/pull/${number}`,
  });
  await upsertTrackedPullRequest({ userId, artifactId: artifact.id, number, lastSeenAt: SEEN });
  return artifact;
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.trackedPullRequest.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.commitmentEvent.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.commitment.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.artifact.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.person.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("upsertTrackedPullRequest", () => {
  it("records an open PR and joins its artifact for title and url", async () => {
    const user = await makeUser("upsert");
    await makePR(user.id, "PR_1", 80);

    const [tracked] = await listOpenTrackedPullRequests(user.id);

    expect(tracked.state).toBe("open");
    expect(tracked.number).toBe(80);
    expect(tracked.artifact.excerpt).toBe("PR 80");
    expect(tracked.artifact.url).toBe("https://github.com/acme/repo/pull/80");
  });

  it("re-stamps lastSeenAt instead of creating a second row", async () => {
    const user = await makeUser("restamp");
    const artifact = await makePR(user.id, "PR_1", 80);
    const later = new Date("2026-08-16T00:00:00.000Z");

    await upsertTrackedPullRequest({ userId: user.id, artifactId: artifact.id, number: 80, lastSeenAt: later });

    const open = await listOpenTrackedPullRequests(user.id);
    expect(open).toHaveLength(1);
    expect(open[0].lastSeenAt).toEqual(later);
  });

  // Unlike a Commitment, whose @@unique([userId, sourceArtifactId]) blocks a
  // second row, one mutable row per PR means reopening is representable.
  it("returns a closed PR to open if GitHub shows it open again", async () => {
    const user = await makeUser("reopen");
    const artifact = await makePR(user.id, "PR_1", 80);
    await closeTrackedPullRequest({ artifactId: artifact.id, state: "merged", at: SEEN });

    await upsertTrackedPullRequest({ userId: user.id, artifactId: artifact.id, number: 80, lastSeenAt: SEEN });

    const [tracked] = await listOpenTrackedPullRequests(user.id);
    expect(tracked.state).toBe("open");
    expect(tracked.closedAt).toBeNull();
  });
});

describe("listOpenPullRequestsWithoutCommitment", () => {
  it("returns a PR with no commitment", async () => {
    const user = await makeUser("bare");
    await makePR(user.id, "PR_1", 80);

    const bare = await listOpenPullRequestsWithoutCommitment(user.id);

    expect(bare).toHaveLength(1);
    expect(bare[0].number).toBe(80);
  });

  // The handoff: once a reviewer is requested the PR becomes a real
  // commitment and must render through that path only, or it shows twice.
  it("excludes a PR once a commitment covers its artifact", async () => {
    const user = await makeUser("handoff");
    const artifact = await makePR(user.id, "PR_1", 80);
    const person = await prisma.person.create({ data: { userId: user.id, displayName: "Alex" } });
    await createCommitment({
      userId: user.id,
      direction: "owed_to_me",
      summary: "Review this",
      counterpartyPersonId: person.id,
      dueAt: null,
      duePrecision: "vague",
      confidence: 1,
      sourceArtifactId: artifact.id,
      quote: "Review this",
    });

    expect(await listOpenPullRequestsWithoutCommitment(user.id)).toHaveLength(0);
    // Still tracked as open — it just renders as a commitment now.
    expect(await listOpenTrackedPullRequests(user.id)).toHaveLength(1);
  });

  it("excludes a closed PR", async () => {
    const user = await makeUser("closed");
    const artifact = await makePR(user.id, "PR_1", 80);

    await closeTrackedPullRequest({ artifactId: artifact.id, state: "merged", at: SEEN });

    expect(await listOpenPullRequestsWithoutCommitment(user.id)).toHaveLength(0);
  });

  it("does not leak another user's PRs", async () => {
    const user = await makeUser("owner");
    const intruder = await makeUser("intruder");
    await makePR(user.id, "PR_1", 80);

    expect(await listOpenPullRequestsWithoutCommitment(intruder.id)).toHaveLength(0);
  });
});

describe("closeTrackedPullRequestIfPresent", () => {
  it("closes tracked state so the UI matches an action the user just took", async () => {
    const user = await makeUser("action");
    const artifact = await makePR(user.id, "PR_1", 80);

    await closeTrackedPullRequestIfPresent({ artifactId: artifact.id, state: "merged", at: SEEN });

    const [tracked] = await prisma.trackedPullRequest.findMany({ where: { artifactId: artifact.id } });
    expect(tracked.state).toBe("merged");
    expect(tracked.closedAt).toEqual(SEEN);
  });

  // A review requested of you has a commitment and no tracked row — acting on
  // it must not throw.
  it("is a no-op for an artifact with no tracked row", async () => {
    const user = await makeUser("untracked");
    const artifact = await createArtifact({
      userId: user.id,
      source: "github",
      externalId: "PR_9",
      occurredAt: SEEN,
      excerpt: "Someone else's PR",
    });

    await expect(
      closeTrackedPullRequestIfPresent({ artifactId: artifact.id, state: "closed", at: SEEN }),
    ).resolves.toBeUndefined();
  });
});
