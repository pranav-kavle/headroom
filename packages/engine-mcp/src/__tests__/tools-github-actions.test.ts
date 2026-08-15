import { describe, expect, it } from "vitest";
import { engineTools, type EngineContext, type GithubActionCommitment } from "../tools";

const NOW = new Date("2026-08-14T09:00:00Z");

function githubCommitment(over: Partial<GithubActionCommitment> = {}): GithubActionCommitment {
  return {
    status: "open",
    sourceArtifact: { source: "github", externalId: "PR_1" },
    ...over,
  };
}

function context(over: Partial<EngineContext> = {}): EngineContext {
  return {
    userId: "u1",
    now: NOW,
    listCommitments: async () => [],
    ...over,
  };
}

function toolNamed(name: string) {
  const tool = engineTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

const ADD_COMMENT_RESPONSE = {
  data: { addComment: { commentEdge: { node: { id: "IC_1", url: "https://github.com/acme/repo/pull/1#issuecomment-1" } } } },
};
const CLOSE_RESPONSE = {
  data: { closePullRequest: { pullRequest: { closedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" } } },
};
const MERGE_RESPONSE = {
  data: { mergePullRequest: { pullRequest: { merged: true, mergedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" } } },
};

describe("comment_on_pr handler", () => {
  it("resolves the PR through the commitment and posts the comment", async () => {
    let sentBody: { variables?: { subjectId?: string; body?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(ADD_COMMENT_RESPONSE));
    };

    const result = await toolNamed("comment_on_pr").handler(
      { commitmentId: "c1", body: "Looks good" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getCommitmentById: async () => githubCommitment(),
      }),
    );

    expect(sentBody.variables).toEqual({ subjectId: "PR_1", body: "Looks good" });
    expect(result).toEqual({ commentUrl: "https://github.com/acme/repo/pull/1#issuecomment-1" });
  });

  it("rejects a commitment not backed by a GitHub PR", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { commitmentId: "c1", body: "Looks good" },
        context({
          githubToken: "gho_test",
          getCommitmentById: async () => githubCommitment({ sourceArtifact: { source: "gmail", externalId: "abc" } }),
        }),
      ),
    ).rejects.toThrow(/not backed by a GitHub pull request/i);
  });

  it("rejects when GitHub is not connected for this user", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { commitmentId: "c1", body: "Looks good" },
        context({ getCommitmentById: async () => githubCommitment() }),
      ),
    ).rejects.toThrow(/not connected/i);
  });

  it("rejects an unknown commitment id", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { commitmentId: "missing", body: "Looks good" },
        context({ githubToken: "gho_test", getCommitmentById: async () => null }),
      ),
    ).rejects.toThrow(/no commitment/i);
  });

  it("requires a body", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { commitmentId: "c1" },
        context({ githubToken: "gho_test", getCommitmentById: async () => githubCommitment() }),
      ),
    ).rejects.toThrow(/body/i);
  });
});

describe("close_pr handler", () => {
  it("resolves the PR through the commitment and closes it", async () => {
    let sentBody: { variables?: { pullRequestId?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(CLOSE_RESPONSE));
    };

    const result = await toolNamed("close_pr").handler(
      { commitmentId: "c1" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getCommitmentById: async () => githubCommitment(),
      }),
    );

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1" });
    expect(result).toEqual({ closedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" });
  });

  it("rejects a commitment not backed by a GitHub PR", async () => {
    await expect(
      toolNamed("close_pr").handler(
        { commitmentId: "c1" },
        context({
          githubToken: "gho_test",
          getCommitmentById: async () => githubCommitment({ sourceArtifact: { source: "gmail", externalId: "abc" } }),
        }),
      ),
    ).rejects.toThrow(/not backed by a GitHub pull request/i);
  });
});

describe("merge_pr handler", () => {
  it("resolves the PR through the commitment and merges it, defaulting to a merge commit", async () => {
    let sentBody: { variables?: { pullRequestId?: string; mergeMethod?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(MERGE_RESPONSE));
    };

    const result = await toolNamed("merge_pr").handler(
      { commitmentId: "c1" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getCommitmentById: async () => githubCommitment(),
      }),
    );

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1", mergeMethod: "MERGE" });
    expect(result).toEqual({ merged: true, mergedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" });
  });

  it("rejects when GitHub is not connected for this user", async () => {
    await expect(
      toolNamed("merge_pr").handler(
        { commitmentId: "c1" },
        context({ getCommitmentById: async () => githubCommitment() }),
      ),
    ).rejects.toThrow(/not connected/i);
  });
});
