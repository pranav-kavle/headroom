import {
  closeCommitment,
  createArtifact,
  createCommitment,
  ensureSelfPerson,
  findArtifactBySourceExternalId,
  findCommitmentBySourceArtifact,
  listCommitments,
  resolvePerson,
} from "@headroom/graph";
import { runIntegrationSync } from "../sync-run";
import { fetchGithubClosedStates, fetchGithubSyncCandidates, type GithubCandidate } from "./api";

export interface GithubSyncSummary {
  created: number;
  closed: number;
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
      if (already) return;

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
    };

    for (const candidate of candidates.reviewRequested) await upsertOne(candidate, "owed_by_me");
    for (const candidate of candidates.assignedIssues) await upsertOne(candidate, "owed_by_me");
    for (const candidate of candidates.authoredOpenPRs) await upsertOne(candidate, "owed_to_me");

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

    return { created, closed };
  });
}
