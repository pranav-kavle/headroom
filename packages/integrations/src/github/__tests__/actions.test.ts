import { describe, expect, it } from "vitest";
import { closeGithubPR, mergeGithubPR, postGithubComment } from "../actions";

const ADD_COMMENT_RESPONSE = {
  data: { addComment: { commentEdge: { node: { id: "IC_1", url: "https://github.com/acme/repo/pull/10#issuecomment-1" } } } },
};

describe("postGithubComment", () => {
  it("posts the addComment mutation with a bearer token and the PR's node id", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init! });
      return new Response(JSON.stringify(ADD_COMMENT_RESPONSE));
    };

    const result = await postGithubComment({
      token: "gho_test",
      pullRequestNodeId: "PR_1",
      body: "Looks good",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(calls[0].url).toBe("https://api.github.com/graphql");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer gho_test");
    const sentBody = JSON.parse(calls[0].init.body as string);
    expect(sentBody.variables).toEqual({ subjectId: "PR_1", body: "Looks good" });
    expect(result).toEqual({ commentUrl: "https://github.com/acme/repo/pull/10#issuecomment-1" });
  });

  it("throws a named error when GitHub returns GraphQL errors", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ errors: [{ message: "Bad credentials" }] }));

    await expect(
      postGithubComment({ token: "bad", pullRequestNodeId: "PR_1", body: "x", fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(/Bad credentials/);
  });
});

const CLOSE_RESPONSE = {
  data: { closePullRequest: { pullRequest: { closedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/10" } } },
};

describe("closeGithubPR", () => {
  it("posts the closePullRequest mutation with the PR's node id", async () => {
    let sentBody: { variables?: { pullRequestId?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(CLOSE_RESPONSE));
    };

    const result = await closeGithubPR({ token: "gho_test", pullRequestNodeId: "PR_1", fetchImpl: fetchImpl as typeof fetch });

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1" });
    expect(result).toEqual({ closedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/10" });
  });

  it("throws a named error when GitHub returns GraphQL errors", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ errors: [{ message: "Pull request already closed" }] }));

    await expect(
      closeGithubPR({ token: "gho_test", pullRequestNodeId: "PR_1", fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(/already closed/);
  });
});

const MERGE_RESPONSE = {
  data: { mergePullRequest: { pullRequest: { merged: true, mergedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/10" } } },
};

describe("mergeGithubPR", () => {
  it("posts the mergePullRequest mutation, defaulting to a merge commit", async () => {
    let sentBody: { variables?: { pullRequestId?: string; mergeMethod?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(MERGE_RESPONSE));
    };

    const result = await mergeGithubPR({ token: "gho_test", pullRequestNodeId: "PR_1", fetchImpl: fetchImpl as typeof fetch });

    expect(sentBody.variables).toEqual({ pullRequestId: "PR_1", mergeMethod: "MERGE" });
    expect(result).toEqual({ merged: true, mergedAt: "2026-08-14T00:00:00Z", url: "https://github.com/acme/repo/pull/10" });
  });

  it("passes through an explicit merge method", async () => {
    let sentBody: { variables?: { mergeMethod?: string } } = {};
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(MERGE_RESPONSE));
    };

    await mergeGithubPR({
      token: "gho_test",
      pullRequestNodeId: "PR_1",
      mergeMethod: "SQUASH",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(sentBody.variables?.mergeMethod).toBe("SQUASH");
  });

  it("throws a named error when GitHub returns GraphQL errors", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ errors: [{ message: "Merge conflict" }] }));

    await expect(
      mergeGithubPR({ token: "gho_test", pullRequestNodeId: "PR_1", fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(/Merge conflict/);
  });
});
