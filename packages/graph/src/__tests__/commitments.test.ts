import { afterEach, describe, expect, it } from "vitest";
import {
  closeCommitment,
  createArtifact,
  createCommitment,
  createUser,
  findCommitmentBySourceArtifact,
  getCommitmentById,
  listCommitments,
  prisma,
} from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_commitment_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

async function makePerson(userId: string, displayName: string) {
  return prisma.person.create({ data: { userId, displayName } });
}

async function makeCommitment(input: {
  userId: string;
  counterpartyPersonId: string;
  sourceArtifactId: string;
  summary: string;
  status?: "open" | "at_risk" | "overdue" | "fulfilled" | "cancelled" | "superseded" | "rejected";
  dueAt?: Date;
  direction?: "owed_by_me" | "owed_to_me";
}) {
  return prisma.commitment.create({
    data: {
      userId: input.userId,
      direction: input.direction ?? "owed_by_me",
      summary: input.summary,
      counterpartyPersonId: input.counterpartyPersonId,
      dueAt: input.dueAt,
      duePrecision: "day",
      status: input.status ?? "open",
      confidence: "0.9",
      sourceArtifactId: input.sourceArtifactId,
      quote: "quoted text",
    },
  });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.commitmentEvent.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.commitment.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.artifact.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.person.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("listCommitments", () => {
  it("returns only the calling user's commitments, with counterparty and source", async () => {
    const owner = await makeUser("list-owner");
    const other = await makeUser("list-other");
    const person = await makePerson(owner.id, "Maya Rodriguez");
    const artifact = await createArtifact({
      userId: owner.id,
      source: "gmail",
      occurredAt: new Date("2026-08-06T09:14:00.000Z"),
      excerpt: "let's target Thursday",
    });
    await makeCommitment({
      userId: owner.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: artifact.id,
      summary: "The migration ships Thursday",
    });
    const otherPerson = await makePerson(other.id, "Someone Else");
    const otherArtifact = await createArtifact({
      userId: other.id,
      source: "gmail",
      occurredAt: new Date(),
      excerpt: "unrelated",
    });
    await makeCommitment({
      userId: other.id,
      counterpartyPersonId: otherPerson.id,
      sourceArtifactId: otherArtifact.id,
      summary: "Someone else's commitment",
    });

    const commitments = await listCommitments(owner.id);

    expect(commitments).toHaveLength(1);
    expect(commitments[0].summary).toBe("The migration ships Thursday");
    expect(commitments[0].counterpartyPerson.displayName).toBe("Maya Rodriguez");
    expect(commitments[0].sourceArtifact.excerpt).toBe("let's target Thursday");
  });

  it("returns an empty array when the user has no commitments", async () => {
    const user = await makeUser("list-empty");

    expect(await listCommitments(user.id)).toEqual([]);
  });

  it("orders open/at_risk/overdue commitments before closed ones, then by dueAt ascending", async () => {
    const user = await makeUser("list-order");
    const person = await makePerson(user.id, "Dave");
    const fulfilledArtifact = await createArtifact({
      userId: user.id,
      source: "voice_note",
      occurredAt: new Date(),
      excerpt: "note 1",
    });
    const laterOpenArtifact = await createArtifact({
      userId: user.id,
      source: "voice_note",
      occurredAt: new Date(),
      excerpt: "note 2",
    });
    const overdueArtifact = await createArtifact({
      userId: user.id,
      source: "voice_note",
      occurredAt: new Date(),
      excerpt: "note 3",
    });
    const fulfilled = await makeCommitment({
      userId: user.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: fulfilledArtifact.id,
      summary: "Already done",
      status: "fulfilled",
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const laterOpen = await makeCommitment({
      userId: user.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: laterOpenArtifact.id,
      summary: "Due later",
      status: "open",
      dueAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    const overdue = await makeCommitment({
      userId: user.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: overdueArtifact.id,
      summary: "Overdue",
      status: "overdue",
      dueAt: new Date("2026-08-05T00:00:00.000Z"),
    });

    const commitments = await listCommitments(user.id);

    expect(commitments.map((c) => c.id)).toEqual([overdue.id, laterOpen.id, fulfilled.id]);
  });
});

describe("getCommitmentById", () => {
  it("returns the commitment when owned by the calling user", async () => {
    const user = await makeUser("detail-owner");
    const person = await makePerson(user.id, "Maya Rodriguez");
    const artifact = await createArtifact({
      userId: user.id,
      source: "gmail",
      occurredAt: new Date(),
      excerpt: "let's target Thursday",
    });
    const commitment = await makeCommitment({
      userId: user.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: artifact.id,
      summary: "The migration ships Thursday",
    });

    const found = await getCommitmentById(commitment.id, user.id);

    expect(found?.id).toBe(commitment.id);
    expect(found?.counterpartyPerson.displayName).toBe("Maya Rodriguez");
  });

  it("returns null when the commitment belongs to a different user", async () => {
    const owner = await makeUser("detail-owner-2");
    const intruder = await makeUser("detail-intruder");
    const person = await makePerson(owner.id, "Maya Rodriguez");
    const artifact = await createArtifact({
      userId: owner.id,
      source: "gmail",
      occurredAt: new Date(),
      excerpt: "let's target Thursday",
    });
    const commitment = await makeCommitment({
      userId: owner.id,
      counterpartyPersonId: person.id,
      sourceArtifactId: artifact.id,
      summary: "The migration ships Thursday",
    });

    expect(await getCommitmentById(commitment.id, intruder.id)).toBeNull();
  });

  it("returns null when the id doesn't exist", async () => {
    const user = await makeUser("detail-missing");

    expect(await getCommitmentById("00000000-0000-0000-0000-000000000000", user.id)).toBeNull();
  });
});

describe("createCommitment / findCommitmentBySourceArtifact", () => {
  it("round-trips a commitment", async () => {
    const user = await makeUser("create_commitment");
    const person = await makePerson(user.id, "mrodriguez");
    const artifact = await createArtifact({
      userId: user.id,
      source: "github",
      externalId: "ext_1",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "Review this",
      url: "https://github.com/acme/repo/pull/1",
    });

    const commitment = await createCommitment({
      userId: user.id,
      direction: "owed_by_me",
      summary: "Review this",
      counterpartyPersonId: person.id,
      dueAt: null,
      duePrecision: "vague",
      confidence: 1,
      sourceArtifactId: artifact.id,
      quote: "Review this",
    });

    expect(commitment.status).toBe("open");
    expect(commitment.direction).toBe("owed_by_me");

    const found = await findCommitmentBySourceArtifact(user.id, artifact.id);
    expect(found?.id).toBe(commitment.id);
  });

  it("returns null when no commitment references that artifact", async () => {
    const user = await makeUser("create_commitment_miss");
    const artifact = await createArtifact({
      userId: user.id,
      source: "github",
      externalId: "ext_2",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "Review this",
      url: "https://github.com/acme/repo/pull/2",
    });

    expect(await findCommitmentBySourceArtifact(user.id, artifact.id)).toBeNull();
  });
});

describe("closeCommitment", () => {
  it("marks a commitment fulfilled and records a CommitmentEvent", async () => {
    const user = await makeUser("close_commitment");
    const person = await makePerson(user.id, "mrodriguez");
    const artifact = await createArtifact({
      userId: user.id,
      source: "github",
      externalId: "ext_3",
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      excerpt: "Review this",
      url: "https://github.com/acme/repo/pull/3",
    });
    const commitment = await createCommitment({
      userId: user.id,
      direction: "owed_by_me",
      summary: "Review this",
      counterpartyPersonId: person.id,
      dueAt: null,
      duePrecision: "vague",
      confidence: 1,
      sourceArtifactId: artifact.id,
      quote: "Review this",
    });
    const at = new Date("2026-08-15T00:00:00.000Z");

    const closed = await closeCommitment({
      id: commitment.id,
      userId: user.id,
      status: "fulfilled",
      reason: "Closed on GitHub.",
      artifactId: artifact.id,
      at,
    });

    expect(closed.status).toBe("fulfilled");
    expect(closed.closedReason).toBe("Closed on GitHub.");
    expect(closed.closedAt).toEqual(at);

    const events = await prisma.commitmentEvent.findMany({ where: { commitmentId: commitment.id } });
    expect(events.map((e) => e.kind).sort()).toEqual(["created", "fulfilled"]);
  });
});
