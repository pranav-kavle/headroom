// GitHub write actions — design doc §8/§16, Tier 2. Merging and closing are
// PR-state transitions on code a human already authored and reviewed, not
// the model generating or pushing code, so they sit in Tier 2 ("outward-
// facing... one tap, always") rather than Tier 4 (deferred, §14).
//
// Every handler takes an `artifactId`, never a raw GitHub node id — the
// model only ever sees the internal id through get_state or check_github, and
// this resolves it server-side so the model can't reach GitHub's id space
// directly.
//
// The handle is the Artifact rather than the Commitment because only *some*
// PRs have a commitment: an authored PR with no requested reviewer has no
// counterparty to owe anything to, so sync deliberately writes an artifact and
// stops there. Keying on the commitment made those PRs unreachable — you could
// see #80 and not act on it. Every synced PR has an artifact, so this reaches
// both kinds, and it matches §3 rule 2, where provenance hangs off the
// artifact.

import { closeGithubPR, mergeGithubPR, postGithubComment } from "@headroom/integrations";
import type { EngineContext, EngineTool } from ".";

// Structural, not Prisma's generated row type — same reasoning as
// StateCommitmentInput in state.ts (port rule 6).
export interface GithubActionArtifact {
  source: string;
  externalId: string | null;
}

interface ResolvedGithubPR {
  token: string;
  pullRequestNodeId: string;
}

async function resolveGithubPullRequest(artifactId: string, context: EngineContext): Promise<ResolvedGithubPR> {
  if (!context.getArtifactById) {
    throw new Error("This engine context cannot look up artifacts.");
  }
  const artifact = await context.getArtifactById(artifactId, context.userId);
  if (!artifact) {
    throw new Error(`No artifact found with id ${artifactId}.`);
  }
  if (artifact.source !== "github" || !artifact.externalId) {
    throw new Error(`Artifact ${artifactId} is not backed by a GitHub pull request.`);
  }
  if (!context.githubToken) {
    throw new Error("GitHub is not connected for this user.");
  }
  return { token: context.githubToken, pullRequestNodeId: artifact.externalId };
}

function requireString(input: Record<string, unknown>, key: string, toolName: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${toolName} requires a ${key}.`);
  }
  return value;
}

const ARTIFACT_ID_PROPERTY = {
  artifactId: {
    type: "string",
    description:
      "The id of the artifact for this PR: sourceArtifactId from get_state's openCommitments, or artifactId from check_github's openPRsWithoutReviewer.",
  },
};

export const githubActionTools: EngineTool[] = [
  {
    name: "comment_on_pr",
    description:
      "Post a comment on a GitHub pull request. Works for any synced PR, including your own PRs with no reviewer requested. Call this when the user asks you to reply on a PR. This needs the user's approval before it runs — offer it, do not claim it is posted.",
    inputSchema: {
      type: "object",
      properties: { ...ARTIFACT_ID_PROPERTY, body: { type: "string", description: "The comment text." } },
      required: ["artifactId", "body"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const artifactId = requireString(input, "artifactId", "comment_on_pr");
      const body = requireString(input, "body", "comment_on_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(artifactId, context);
      return postGithubComment({ token, pullRequestNodeId, body, fetchImpl: context.fetchImpl });
    },
  },
  {
    name: "close_pr",
    description:
      "Close a GitHub pull request without merging it. Works for any synced PR, including your own PRs with no reviewer requested. Call this when the user asks you to close a PR. This needs the user's approval before it runs — offer it, do not claim it is closed.",
    inputSchema: {
      type: "object",
      properties: ARTIFACT_ID_PROPERTY,
      required: ["artifactId"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const artifactId = requireString(input, "artifactId", "close_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(artifactId, context);
      const result = await closeGithubPR({ token, pullRequestNodeId, fetchImpl: context.fetchImpl });
      // Only after GitHub confirms — recording it first would leave the UI
      // asserting a close that never happened.
      await context.markPullRequestClosed?.(artifactId, "closed");
      return result;
    },
  },
  {
    name: "merge_pr",
    description:
      "Merge a GitHub pull request, using a merge commit. Works for any synced PR, including your own PRs with no reviewer requested. Call this when the user asks you to merge a PR. This needs the user's approval before it runs — offer it, do not claim it is merged.",
    inputSchema: {
      type: "object",
      properties: ARTIFACT_ID_PROPERTY,
      required: ["artifactId"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const artifactId = requireString(input, "artifactId", "merge_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(artifactId, context);
      const result = await mergeGithubPR({ token, pullRequestNodeId, fetchImpl: context.fetchImpl });
      await context.markPullRequestClosed?.(artifactId, "merged");
      return result;
    },
  },
];
