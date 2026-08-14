import { describe, expect, it } from "vitest";
import {
  fetchGithubClosedStates,
  fetchGithubSyncCandidates,
  parseGithubClosedStates,
  parseGithubSyncCandidates,
} from "../api";

const SYNC_RESPONSE = {
  data: {
    viewer: { login: "pranav-kavle", name: "Pranav Kavle" },
    reviewRequested: {
      nodes: [
        {
          id: "PR_1",
          number: 10,
          title: "Add retries",
          url: "https://github.com/acme/repo/pull/10",
          createdAt: "2026-08-10T00:00:00Z",
          author: { login: "mrodriguez" },
        },
      ],
    },
    assignedIssues: {
      nodes: [
        {
          id: "ISSUE_1",
          number: 20,
          title: "Flaky test",
          url: "https://github.com/acme/repo/issues/20",
          createdAt: "2026-08-11T00:00:00Z",
          author: { login: "jsmith" },
        },
      ],
    },
    authoredOpenPRs: {
      nodes: [
        {
          id: "PR_2",
          number: 30,
          title: "Ship the thing",
          url: "https://github.com/acme/repo/pull/30",
          createdAt: "2026-08-12T00:00:00Z",
          reviewRequests: { nodes: [{ requestedReviewer: { __typename: "User", login: "mrodriguez" } }] },
        },
        {
          id: "PR_3",
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
          reviewRequests: { nodes: [] },
        },
        {
          id: "PR_4",
          number: 32,
          title: "Team review only",
          url: "https://github.com/acme/repo/pull/32",
          createdAt: "2026-08-13T00:00:00Z",
          reviewRequests: { nodes: [{ requestedReviewer: { __typename: "Team", name: "core" } }] },
        },
      ],
    },
  },
};

describe("parseGithubSyncCandidates", () => {
  it("maps review requests and assigned issues, counterparty is the author", () => {
    const result = parseGithubSyncCandidates(SYNC_RESPONSE);

    expect(result.viewerLogin).toBe("pranav-kavle");
    expect(result.reviewRequested).toEqual([
      {
        nodeId: "PR_1",
        number: 10,
        title: "Add retries",
        url: "https://github.com/acme/repo/pull/10",
        createdAt: "2026-08-10T00:00:00Z",
        counterpartyLogin: "mrodriguez",
      },
    ]);
    expect(result.assignedIssues[0].counterpartyLogin).toBe("jsmith");
  });

  it("keeps only authored PRs with a User requested as reviewer", () => {
    const result = parseGithubSyncCandidates(SYNC_RESPONSE);

    expect(result.authoredOpenPRs).toHaveLength(1);
    expect(result.authoredOpenPRs[0]).toEqual({
      nodeId: "PR_2",
      number: 30,
      title: "Ship the thing",
      url: "https://github.com/acme/repo/pull/30",
      createdAt: "2026-08-12T00:00:00Z",
      counterpartyLogin: "mrodriguez",
    });
  });
});

describe("fetchGithubSyncCandidates", () => {
  it("posts the query with a bearer token and parses the response", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init! });
      return new Response(JSON.stringify(SYNC_RESPONSE));
    };

    const result = await fetchGithubSyncCandidates({ token: "gho_test", fetchImpl: fetchImpl as typeof fetch });

    expect(result.viewerLogin).toBe("pranav-kavle");
    expect(calls[0].url).toBe("https://api.github.com/graphql");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer gho_test");
  });

  it("throws a named error when GitHub returns GraphQL errors", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ errors: [{ message: "Bad credentials" }] }));

    await expect(
      fetchGithubSyncCandidates({ token: "bad", fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(/Bad credentials/);
  });
});

const CLOSED_CHECK_RESPONSE = {
  data: {
    nodes: [
      { id: "PR_1", merged: true, state: "MERGED" },
      { id: "PR_2", merged: false, state: "CLOSED" },
      { id: "ISSUE_1", state: "CLOSED", stateReason: "COMPLETED" },
      { id: "ISSUE_2", state: "CLOSED", stateReason: "NOT_PLANNED" },
      { id: "ISSUE_3", state: "OPEN", stateReason: null },
    ],
  },
};

describe("parseGithubClosedStates", () => {
  it("maps a merged PR to fulfilled and a closed-without-merging PR to cancelled", () => {
    const result = parseGithubClosedStates(CLOSED_CHECK_RESPONSE);

    expect(result).toContainEqual({ nodeId: "PR_1", closedAs: "fulfilled" });
    expect(result).toContainEqual({ nodeId: "PR_2", closedAs: "cancelled" });
  });

  it("maps an issue's stateReason to fulfilled or cancelled", () => {
    const result = parseGithubClosedStates(CLOSED_CHECK_RESPONSE);

    expect(result).toContainEqual({ nodeId: "ISSUE_1", closedAs: "fulfilled" });
    expect(result).toContainEqual({ nodeId: "ISSUE_2", closedAs: "cancelled" });
  });

  it("omits anything still open rather than guessing", () => {
    const result = parseGithubClosedStates(CLOSED_CHECK_RESPONSE);

    expect(result.find((r) => r.nodeId === "ISSUE_3")).toBeUndefined();
  });
});

describe("fetchGithubClosedStates", () => {
  it("sends the node ids as GraphQL variables", async () => {
    let sentBody: unknown;
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify(CLOSED_CHECK_RESPONSE));
    };

    await fetchGithubClosedStates({
      token: "gho_test",
      nodeIds: ["PR_1", "PR_2"],
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect((sentBody as { variables: { ids: string[] } }).variables.ids).toEqual(["PR_1", "PR_2"]);
  });
});
