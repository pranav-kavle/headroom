import {
  closeCommitment,
  closeTrackedPullRequest,
  createArtifact,
  createCommitment,
  ensureSelfPerson,
  findArtifactBySourceExternalId,
  findCommitmentBySourceArtifact,
  listCommitments,
  listOpenTrackedPullRequests,
  resolvePerson,
  upsertTrackedPullRequest,
} from "@headroom/graph";
import { runIntegrationSync } from "../sync-run";
import { fetchGithubClosedStates, fetchGithubSyncCandidates, type GithubBarePR, type GithubCandidate } from "./api";

export interface GithubSyncSummary {
  created: number;
  closed: number;
  // Your own open PRs with no reviewer requested — facts, not Commitments
  // (there's no counterparty to name), reported fresh each sync. `artifactId`
  // is what the GitHub write actions take, so these PRs are actionable
  // despite having no commitment.
  openPRsWithoutReviewer: Array<{
    artifactId: string;
    number: number;
    title: string;
    url: string;
    createdAt: string;
  }>;
}

const OPEN_STATUSES = ["open", "at_risk", "overdue"];

export async function syncGithub(input: {
  userId: string;
  token: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<GithubSyncSummary> {
  return runIntegrationSync({ userId: input.userId, source: "github", now: input.now }, async () => {
    const candidates = await fetchGithubSyncCandidates({ token: input.token, fetchImpl: input.fetchImpl });

    await ensureSelfPerson({
      userId: input.userId,
      displayName: candidates.viewerName ?? candidates.viewerLogin,
      githubLogin: candidates.viewerLogin,
    });

    let created = 0;
    const seenExternalIds = new Set<string>();

    const upsertOne = async (candidate: GithubCandidate, direction: "owed_by_me" | "owed_to_me") => {
      seenExternalIds.add(candidate.nodeId);

      let artifact = await findArtifactBySourceExternalId(input.userId, "github", candidate.nodeId);
      if (!artifact) {
        artifact = await createArtifact({
          userId: input.userId,
          source: "github",
          externalId: candidate.nodeId,
          occurredAt: new Date(candidate.createdAt),
          excerpt: candidate.title,
          url: candidate.url,
        });
      }

      const already = await findCommitmentBySourceArtifact(input.userId, artifact.id);
      if (already) return artifact;

      const counterparty = await resolvePerson({
        userId: input.userId,
        kind: "github",
        value: candidate.counterpartyLogin,
        confidence: 1,
        displayName: candidate.counterpartyLogin,
        githubLogin: candidate.counterpartyLogin,
      });

      await createCommitment({
        userId: input.userId,
        direction,
        summary: candidate.title,
        counterpartyPersonId: counterparty.id,
        dueAt: null,
        duePrecision: "vague",
        confidence: 1,
        sourceArtifactId: artifact.id,
        quote: candidate.title,
      });
      created += 1;
      return artifact;
    };

    // Your own open PRs get a TrackedPullRequest whether or not they have a
    // reviewer. Tracking both buckets is what stops a PR that *gains* a
    // reviewer from looking closed: it moves from one bucket to the other,
    // stays "seen" either way, and so never triggers the closed-state check
    // below. Which of the two renders in the UI is decided later, by whether a
    // commitment covers the artifact — not here.
    const seenTrackedArtifactIds = new Set<string>();
    const trackPR = async (artifactId: string, number: number) => {
      seenTrackedArtifactIds.add(artifactId);
      await upsertTrackedPullRequest({ userId: input.userId, artifactId, number, lastSeenAt: input.now });
    };

    for (const candidate of candidates.reviewRequested) await upsertOne(candidate, "owed_by_me");
    for (const candidate of candidates.assignedIssues) await upsertOne(candidate, "owed_by_me");
    for (const candidate of candidates.authoredOpenPRs) {
      const artifact = await upsertOne(candidate, "owed_to_me");
      await trackPR(artifact.id, candidate.number);
    }

    // The artifact id is kept, not discarded: it is the handle the GitHub
    // write actions resolve through, so a reviewer-less PR is only actionable
    // if this id reaches the caller.
    const barePRArtifactIds = new Map<string, string>();

    const upsertBarePR = async (pr: GithubBarePR) => {
      seenExternalIds.add(pr.nodeId);

      const existing = await findArtifactBySourceExternalId(input.userId, "github", pr.nodeId);
      const artifact =
        existing ??
        (await createArtifact({
          userId: input.userId,
          source: "github",
          externalId: pr.nodeId,
          occurredAt: new Date(pr.createdAt),
          excerpt: pr.title,
          url: pr.url,
        }));
      barePRArtifactIds.set(pr.nodeId, artifact.id);
      await trackPR(artifact.id, pr.number);
    };

    for (const pr of candidates.authoredOpenPRsWithoutReviewer) await upsertBarePR(pr);

    // Invalidation — design doc §5: any open GitHub commitment this sync
    // didn't see gets checked against GitHub's own state before closing.
    const existing = await listCommitments(input.userId);
    const stale = existing.filter(
      (commitment) =>
        commitment.sourceArtifact.source === "github" &&
        OPEN_STATUSES.includes(commitment.status) &&
        commitment.sourceArtifact.externalId !== null &&
        !seenExternalIds.has(commitment.sourceArtifact.externalId),
    );

    let closed = 0;
    if (stale.length > 0) {
      const states = await fetchGithubClosedStates({
        token: input.token,
        nodeIds: stale.map((commitment) => commitment.sourceArtifact.externalId as string),
        fetchImpl: input.fetchImpl,
      });
      const closedAsByNodeId = new Map(states.map((s) => [s.nodeId, s.closedAs]));

      for (const commitment of stale) {
        const closedAs = closedAsByNodeId.get(commitment.sourceArtifact.externalId as string);
        if (!closedAs) continue; // Still ambiguous — left open, per §3 rule 5.

        await closeCommitment({
          id: commitment.id,
          userId: input.userId,
          status: closedAs,
          reason: closedAs === "fulfilled" ? "Closed on GitHub." : "Closed on GitHub without merging.",
          artifactId: commitment.sourceArtifactId,
          at: input.now,
        });
        closed += 1;
      }
    }

    // The same invalidation, for your own PRs. It has to be separate from the
    // commitment pass above because a reviewer-less PR has no commitment to
    // close — without this, a merged PR would sit on your Brief forever, since
    // an Artifact has no status to go stale.
    const trackedOpen = await listOpenTrackedPullRequests(input.userId);
    const staleTracked = trackedOpen.filter(
      (tracked) => tracked.artifact.externalId !== null && !seenTrackedArtifactIds.has(tracked.artifactId),
    );

    if (staleTracked.length > 0) {
      const states = await fetchGithubClosedStates({
        token: input.token,
        nodeIds: staleTracked.map((tracked) => tracked.artifact.externalId as string),
        fetchImpl: input.fetchImpl,
      });
      const closedAsByNodeId = new Map(states.map((s) => [s.nodeId, s.closedAs]));

      for (const tracked of staleTracked) {
        const closedAs = closedAsByNodeId.get(tracked.artifact.externalId as string);
        if (!closedAs) continue; // Still ambiguous — left open, per §3 rule 5.

        await closeTrackedPullRequest({
          artifactId: tracked.artifactId,
          // fulfilled/cancelled is commitment vocabulary; a PR of your own is
          // merged or just closed.
          state: closedAs === "fulfilled" ? "merged" : "closed",
          at: input.now,
        });
      }
    }

    return {
      created,
      closed,
      openPRsWithoutReviewer: candidates.authoredOpenPRsWithoutReviewer.map(({ nodeId, number, title, url, createdAt }) => ({
        artifactId: barePRArtifactIds.get(nodeId) as string,
        number,
        title,
        url,
        createdAt,
      })),
    };
  });
}
