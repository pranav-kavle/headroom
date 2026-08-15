// GitHub write actions — design doc §8/§16, Tier 2 ("outward-facing... one
// tap, always"). Same raw-fetch-against-GraphQL convention as api.ts; these
// never run themselves — the tier gate in agent-loop.ts decides that.

type RawNode = Record<string, unknown>;

async function postGraphqlMutation(input: {
  token: string;
  query: string;
  variables: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<RawNode> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: input.query, variables: input.variables }),
  });
  const json = (await response.json()) as { data?: RawNode; errors?: Array<{ message: string }> };
  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data ?? {};
}

const ADD_COMMENT_MUTATION = `
  mutation HeadroomAddComment($subjectId: ID!, $body: String!) {
    addComment(input: { subjectId: $subjectId, body: $body }) {
      commentEdge { node { id url } }
    }
  }
`;

export async function postGithubComment(input: {
  token: string;
  pullRequestNodeId: string;
  body: string;
  fetchImpl?: typeof fetch;
}): Promise<{ commentUrl: string }> {
  const data = await postGraphqlMutation({
    token: input.token,
    query: ADD_COMMENT_MUTATION,
    variables: { subjectId: input.pullRequestNodeId, body: input.body },
    fetchImpl: input.fetchImpl,
  });
  const node = (data.addComment as { commentEdge: { node: { url: string } } }).commentEdge.node;
  return { commentUrl: node.url };
}

const CLOSE_PULL_REQUEST_MUTATION = `
  mutation HeadroomClosePR($pullRequestId: ID!) {
    closePullRequest(input: { pullRequestId: $pullRequestId }) {
      pullRequest { closedAt url }
    }
  }
`;

export async function closeGithubPR(input: {
  token: string;
  pullRequestNodeId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ closedAt: string; url: string }> {
  const data = await postGraphqlMutation({
    token: input.token,
    query: CLOSE_PULL_REQUEST_MUTATION,
    variables: { pullRequestId: input.pullRequestNodeId },
    fetchImpl: input.fetchImpl,
  });
  const pr = (data.closePullRequest as { pullRequest: { closedAt: string; url: string } }).pullRequest;
  return { closedAt: pr.closedAt, url: pr.url };
}

const MERGE_PULL_REQUEST_MUTATION = `
  mutation HeadroomMergePR($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
    mergePullRequest(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
      pullRequest { merged mergedAt url }
    }
  }
`;

export async function mergeGithubPR(input: {
  token: string;
  pullRequestNodeId: string;
  mergeMethod?: "MERGE" | "SQUASH" | "REBASE";
  fetchImpl?: typeof fetch;
}): Promise<{ merged: boolean; mergedAt: string; url: string }> {
  const data = await postGraphqlMutation({
    token: input.token,
    query: MERGE_PULL_REQUEST_MUTATION,
    variables: { pullRequestId: input.pullRequestNodeId, mergeMethod: input.mergeMethod ?? "MERGE" },
    fetchImpl: input.fetchImpl,
  });
  const pr = (data.mergePullRequest as { pullRequest: { merged: boolean; mergedAt: string; url: string } }).pullRequest;
  return { merged: pr.merged, mergedAt: pr.mergedAt, url: pr.url };
}
