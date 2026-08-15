// GitHub on-demand check — design doc §3, spec
// docs/superpowers/specs/2026-08-14-github-open-prs-design.md. Sync stays
// manual-or-triggered, never scheduled: this tool is the trigger, so a
// question about open PRs forces a fresh sync instead of answering from
// however-stale (or entirely absent) data already sits in Postgres.
//
// A read of our own data plus a read-only GraphQL call against GitHub
// (search/nodes) — no third-party side effect, so no tier to gate.

import { syncGithub, type GithubSyncSummary } from "@headroom/integrations";
import type { EngineContext, EngineTool } from ".";

export const checkGithubTool: EngineTool = {
  name: "check_github",
  description:
    "Triggers a fresh GitHub sync and reports what changed, plus your own open PRs that have no reviewer requested yet (these aren't commitments, since they aren't owed to anyone). Call this whenever the user asks about open PRs or GitHub review status — PR and review state changes constantly and you were not trained on today's, so never answer this from memory. Call get_state afterward for full owed_by_me/owed_to_me counts, which already include GitHub — this tool only adds the one thing get_state structurally can't: PRs with no counterparty.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  external: true,
  aboutUser: true,
  handler: async (_input, context: EngineContext): Promise<GithubSyncSummary> => {
    if (!context.githubToken) {
      throw new Error("GitHub is not connected for this user.");
    }
    return syncGithub({
      userId: context.userId,
      token: context.githubToken,
      now: context.now,
      fetchImpl: context.fetchImpl,
    });
  },
};
