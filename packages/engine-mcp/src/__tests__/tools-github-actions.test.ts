import { describe, expect, it } from "vitest";
import { engineTools, type EngineContext, type GithubActionArtifact } from "../tools";

const NOW = new Date("2026-08-14T09:00:00Z");

function githubArtifact(over: Partial<GithubActionArtifact> = {}): GithubActionArtifact {
  return {
    source: "github",
    externalId: "PR_1",
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
  it("resolves the PR through the artifact and posts the comment", async () => {
    let sentBody: { variables?: { subjectId?: string; body?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(ADD_COMMENT_RESPONSE));
    };

    const result = await toolNamed("comment_on_pr").handler(
      { artifactId: "a1", body: "Looks good" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getArtifactById: async () => githubArtifact(),
      }),
    );

    expect(sentBody.variables).toEqual({ subjectId: "PR_1", body: "Looks good" });
    expect(result).toEqual({ commentUrl: "https://github.com/acme/repo/pull/1#issuecomment-1" });
  });

  // The bug this addressing change exists to fix: an authored PR with no
  // reviewer gets an Artifact but deliberately no Commitment (sync.ts), so
  // commitment-keyed tools could never reach it. The artifact is the handle.
  it("acts on a PR that has an artifact but no commitment", async () => {
    const fetchImpl = async () => new Response(JSON.stringify(ADD_COMMENT_RESPONSE));

    const result = await toolNamed("comment_on_pr").handler(
      { artifactId: "artifact-bare-pr", body: "demo successful" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getArtifactById: async () => githubArtifact({ externalId: "PR_80" }),
        // No commitment lookup at all — this is the reviewer-less case.
        listCommitments: async () => [],
      }),
    );

    expect(result).toEqual({ commentUrl: "https://github.com/acme/repo/pull/1#issuecomment-1" });
  });

  it("rejects an artifact not backed by a GitHub PR", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { artifactId: "a1", body: "Looks good" },
        context({
          githubToken: "gho_test",
          getArtifactById: async () => githubArtifact({ source: "gmail", externalId: "abc" }),
        }),
      ),
    ).rejects.toThrow(/not backed by a GitHub pull request/i);
  });

  it("rejects an artifact with no external id", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { artifactId: "a1", body: "Looks good" },
        context({
          githubToken: "gho_test",
          getArtifactById: async () => githubArtifact({ externalId: null }),
        }),
      ),
    ).rejects.toThrow(/not backed by a GitHub pull request/i);
  });

  it("rejects when GitHub is not connected for this user", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { artifactId: "a1", body: "Looks good" },
        context({ getArtifactById: async () => githubArtifact() }),
      ),
    ).rejects.toThrow(/not connected/i);
  });

  it("rejects an unknown artifact id", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { artifactId: "missing", body: "Looks good" },
        context({ githubToken: "gho_test", getArtifactById: async () => null }),
      ),
    ).rejects.toThrow(/no artifact/i);
  });

  it("requires a body", async () => {
    await expect(
      toolNamed("comment_on_pr").handler(
        { artifactId: "a1" },
        context({ githubToken: "gho_test", getArtifactById: async () => githubArtifact() }),
      ),
    ).rejects.toThrow(/body/i);
  });
});

describe("close_pr handler", () => {
  it("resolves the PR through the artifact and closes it", async () => {
    let sentBody: { variables?: { pullRequestId?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(CLOSE_RESPONSE));
    };

    const result = await toolNamed("close_pr").handler(
      { artifactId: "a1" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getArtifactById: async () => githubArtifact(),
      }),
    );

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1" });
    expect(result).toEqual({ closedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" });
  });

  it("rejects an artifact not backed by a GitHub PR", async () => {
    await expect(
      toolNamed("close_pr").handler(
        { artifactId: "a1" },
        context({
          githubToken: "gho_test",
          getArtifactById: async () => githubArtifact({ source: "gmail", externalId: "abc" }),
        }),
      ),
    ).rejects.toThrow(/not backed by a GitHub pull request/i);
  });
});

describe("merge_pr handler", () => {
  it("resolves the PR through the artifact and merges it, defaulting to a merge commit", async () => {
    let sentBody: { variables?: { pullRequestId?: string; mergeMethod?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(MERGE_RESPONSE));
    };

    const result = await toolNamed("merge_pr").handler(
      { artifactId: "a1" },
      context({
        githubToken: "gho_test",
        fetchImpl: fetchImpl as typeof fetch,
        getArtifactById: async () => githubArtifact(),
      }),
    );

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1", mergeMethod: "MERGE" });
    expect(result).toEqual({ merged: true, mergedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/1" });
  });

  it("rejects when GitHub is not connected for this user", async () => {
    await expect(
      toolNamed("merge_pr").handler({ artifactId: "a1" }, context({ getArtifactById: async () => githubArtifact() })),
    ).rejects.toThrow(/not connected/i);
  });
});

// Without this the UI would still show the PR as open right after the user
// watched it merge, until the next sync happened to run.
describe("tracked state after a write action", () => {
  it("marks the PR merged once GitHub confirms the merge", async () => {
    const marked: Array<[string, string]> = [];

    await toolNamed("merge_pr").handler(
      { artifactId: "a1" },
      context({
        githubToken: "gho_test",
        fetchImpl: (async () => new Response(JSON.stringify(MERGE_RESPONSE))) as typeof fetch,
        getArtifactById: async () => githubArtifact(),
        markPullRequestClosed: async (id, state) => {
          marked.push([id, state]);
        },
      }),
    );

    expect(marked).toEqual([["a1", "merged"]]);
  });

  it("marks a closed PR closed, not merged", async () => {
    const marked: Array<[string, string]> = [];

    await toolNamed("close_pr").handler(
      { artifactId: "a1" },
      context({
        githubToken: "gho_test",
        fetchImpl: (async () => new Response(JSON.stringify(CLOSE_RESPONSE))) as typeof fetch,
        getArtifactById: async () => githubArtifact(),
        markPullRequestClosed: async (id, state) => {
          marked.push([id, state]);
        },
      }),
    );

    expect(marked).toEqual([["a1", "closed"]]);
  });

  it("does not record a close when GitHub rejects the merge", async () => {
    const marked: Array<[string, string]> = [];

    await expect(
      toolNamed("merge_pr").handler(
        { artifactId: "a1" },
        context({
          githubToken: "gho_test",
          fetchImpl: (async () =>
            new Response(JSON.stringify({ errors: [{ message: "not mergeable" }] }))) as typeof fetch,
          getArtifactById: async () => githubArtifact(),
          markPullRequestClosed: async (id, state) => {
            marked.push([id, state]);
          },
        }),
      ),
    ).rejects.toThrow();

    expect(marked).toEqual([]);
  });

  // Commenting changes nothing about whether the PR is open.
  it("leaves tracked state alone after a comment", async () => {
    const marked: Array<[string, string]> = [];

    await toolNamed("comment_on_pr").handler(
      { artifactId: "a1", body: "demo successful" },
      context({
        githubToken: "gho_test",
        fetchImpl: (async () => new Response(JSON.stringify(ADD_COMMENT_RESPONSE))) as typeof fetch,
        getArtifactById: async () => githubArtifact(),
        markPullRequestClosed: async (id, state) => {
          marked.push([id, state]);
        },
      }),
    );

    expect(marked).toEqual([]);
  });
});
