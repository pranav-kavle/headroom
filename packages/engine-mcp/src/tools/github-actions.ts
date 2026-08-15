// GitHub write actions — design doc §8/§16, Tier 2. Merging and closing are
// PR-state transitions on code a human already authored and reviewed, not
// the model generating or pushing code, so they sit in Tier 2 ("outward-
// facing... one tap, always") rather than Tier 4 (deferred, §14).
//
// Every handler takes a `commitmentId`, never a raw GitHub node id — the
// model only ever sees the internal id through get_state, and this resolves
// it server-side so the model can't reach GitHub's id space directly.

import { closeGithubPR, mergeGithubPR, postGithubComment } from "@headroom/integrations";
import type { EngineContext, EngineTool } from ".";

// Structural, not Prisma's generated row type — same reasoning as
// StateCommitmentInput in state.ts (port rule 6).
export interface GithubActionCommitment {
  status: string;
  sourceArtifact: { source: string; externalId: string | null };
}

interface ResolvedGithubPR {
  token: string;
  pullRequestNodeId: string;
}

async function resolveGithubPullRequest(commitmentId: string, context: EngineContext): Promise<ResolvedGithubPR> {
  if (!context.getCommitmentById) {
    throw new Error("This engine context cannot look up commitments.");
  }
  const commitment = await context.getCommitmentById(commitmentId, context.userId);
  if (!commitment) {
    throw new Error(`No commitment found with id ${commitmentId}.`);
  }
  if (commitment.sourceArtifact.source !== "github" || !commitment.sourceArtifact.externalId) {
    throw new Error(`Commitment ${commitmentId} is not backed by a GitHub pull request.`);
  }
  if (!context.githubToken) {
    throw new Error("GitHub is not connected for this user.");
  }
  return { token: context.githubToken, pullRequestNodeId: commitment.sourceArtifact.externalId };
}

function requireString(input: Record<string, unknown>, key: string, toolName: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${toolName} requires a ${key}.`);
  }
  return value;
}

const COMMITMENT_ID_PROPERTY = {
  commitmentId: {
    type: "string",
    description: "The id of the commitment tracking this PR, from get_state's openCommitments.",
  },
};

export const githubActionTools: EngineTool[] = [
  {
    name: "comment_on_pr",
    description:
      "Post a comment on the GitHub pull request behind a commitment. Call this when the user asks you to reply on a PR. This needs the user's approval before it runs — offer it, do not claim it is posted.",
    inputSchema: {
      type: "object",
      properties: { ...COMMITMENT_ID_PROPERTY, body: { type: "string", description: "The comment text." } },
      required: ["commitmentId", "body"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const commitmentId = requireString(input, "commitmentId", "comment_on_pr");
      const body = requireString(input, "body", "comment_on_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(commitmentId, context);
      return postGithubComment({ token, pullRequestNodeId, body, fetchImpl: context.fetchImpl });
    },
  },
  {
    name: "close_pr",
    description:
      "Close the GitHub pull request behind a commitment, without merging it. Call this when the user asks you to close a PR. This needs the user's approval before it runs — offer it, do not claim it is closed.",
    inputSchema: {
      type: "object",
      properties: COMMITMENT_ID_PROPERTY,
      required: ["commitmentId"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const commitmentId = requireString(input, "commitmentId", "close_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(commitmentId, context);
      return closeGithubPR({ token, pullRequestNodeId, fetchImpl: context.fetchImpl });
    },
  },
  {
    name: "merge_pr",
    description:
      "Merge the GitHub pull request behind a commitment, using a merge commit. Call this when the user asks you to merge a PR. This needs the user's approval before it runs — offer it, do not claim it is merged.",
    inputSchema: {
      type: "object",
      properties: COMMITMENT_ID_PROPERTY,
      required: ["commitmentId"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const commitmentId = requireString(input, "commitmentId", "merge_pr");
      const { token, pullRequestNodeId } = await resolveGithubPullRequest(commitmentId, context);
      return mergeGithubPR({ token, pullRequestNodeId, fetchImpl: context.fetchImpl });
    },
  },
];
