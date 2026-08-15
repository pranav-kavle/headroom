// Open/closed state for your own PRs — the state an Artifact deliberately
// cannot hold. See the TrackedPullRequest comment in schema.prisma for why
// this model exists at all.
//
// Title, url and occurredAt are read off the joined Artifact rather than
// stored twice: the artifact stays the single provenance record (§3 rule 2),
// and this table holds only what changes.

import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import type { Artifact, TrackedPullRequest, TrackedPullRequestState } from "./generated/prisma/client";

export type TrackedPullRequestRow = TrackedPullRequest & { artifact: Artifact };

const INCLUDE = { artifact: true } as const;

/**
 * Records a PR as open, or re-stamps one already recorded. Called for every
 * open authored PR a sync sees, so `lastSeenAt` separates "still open" from
 * "not looked at since".
 */
export function upsertTrackedPullRequest(input: {
  userId: string;
  artifactId: string;
  number: number;
  lastSeenAt: Date;
}): Promise<TrackedPullRequest> {
  return prisma.trackedPullRequest.upsert({
    where: { artifactId: input.artifactId },
    // A PR that was closed and is open again on GitHub goes back to open —
    // unlike a Commitment, whose unique constraint blocks a second row, this
    // is one mutable row per PR and so reopening is representable.
    update: { state: "open", closedAt: null, lastSeenAt: input.lastSeenAt, number: input.number },
    create: {
      id: randomUUID(),
      userId: input.userId,
      artifactId: input.artifactId,
      number: input.number,
      state: "open",
      lastSeenAt: input.lastSeenAt,
    },
  });
}

export function listOpenTrackedPullRequests(userId: string): Promise<TrackedPullRequestRow[]> {
  return prisma.trackedPullRequest.findMany({
    where: { userId, state: "open" },
    include: INCLUDE,
    orderBy: [{ number: "desc" }],
  });
}

/**
 * The UI's list: open PRs of yours that no Commitment covers.
 *
 * The exclusion is what keeps a PR from appearing twice. A reviewer-less PR
 * that later gains a reviewer becomes a real commitment, and from that moment
 * it renders through the commitment path instead — no handoff bookkeeping, the
 * absence of a commitment is itself the condition.
 */
export function listOpenPullRequestsWithoutCommitment(userId: string): Promise<TrackedPullRequestRow[]> {
  return prisma.trackedPullRequest.findMany({
    where: {
      userId,
      state: "open",
      artifact: { sourcedCommitments: { none: {} } },
    },
    include: INCLUDE,
    orderBy: [{ number: "desc" }],
  });
}

export function closeTrackedPullRequest(input: {
  artifactId: string;
  state: Extract<TrackedPullRequestState, "merged" | "closed">;
  at: Date;
}): Promise<TrackedPullRequest> {
  return prisma.trackedPullRequest.update({
    where: { artifactId: input.artifactId },
    data: { state: input.state, closedAt: input.at },
  });
}

/**
 * Closes tracked state if a row exists, and stays silent if it doesn't.
 *
 * The write actions call this after merging or closing on GitHub: acting on a
 * PR is the one moment we know its new state without asking, so waiting for
 * the next sync would leave the UI contradicting an action the user just
 * watched succeed. Not every actioned PR is tracked, though — a review
 * requested *of you* has a commitment and no TrackedPullRequest row — so a
 * missing row is the normal case, not an error.
 */
export async function closeTrackedPullRequestIfPresent(input: {
  artifactId: string;
  state: Extract<TrackedPullRequestState, "merged" | "closed">;
  at: Date;
}): Promise<void> {
  await prisma.trackedPullRequest.updateMany({
    where: { artifactId: input.artifactId },
    data: { state: input.state, closedAt: input.at },
  });
}
