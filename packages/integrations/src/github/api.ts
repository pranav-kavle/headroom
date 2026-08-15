// GitHub as a source integration — design doc §4/§16. Three signals only:
// review requests, assigned issues, and your own open PRs with a requested
// reviewer. Raw fetch against GitHub's GraphQL API, matching the
// no-SDK convention already used for weather/events/flight lookups.

export interface GithubCandidate {
  nodeId: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  counterpartyLogin: string;
}

export interface GithubBarePR {
  nodeId: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface GithubSyncCandidates {
  viewerLogin: string;
  viewerName: string | null;
  reviewRequested: GithubCandidate[];
  assignedIssues: GithubCandidate[];
  authoredOpenPRs: GithubCandidate[];
  // Authored open PRs with no User reviewer requested (none at all, or only
  // a Team) — not a Commitment candidate, since there's no one to name as
  // counterparty, but still a fact worth surfacing.
  authoredOpenPRsWithoutReviewer: GithubBarePR[];
}

const SYNC_QUERY = `
  query HeadroomGithubSync {
    viewer { login name }
    reviewRequested: search(query: "is:pr is:open review-requested:@me archived:false", type: ISSUE, first: 25) {
      nodes { ... on PullRequest { id number title url createdAt author { login } } }
    }
    assignedIssues: search(query: "is:issue is:open assignee:@me archived:false", type: ISSUE, first: 25) {
      nodes { ... on Issue { id number title url createdAt author { login } } }
    }
    authoredOpenPRs: search(query: "is:pr is:open author:@me archived:false", type: ISSUE, first: 25) {
      nodes {
        ... on PullRequest {
          id number title url createdAt
          reviewRequests(first: 1) { nodes { requestedReviewer { __typename ... on User { login } } } }
        }
      }
    }
  }
`;

type RawNode = Record<string, unknown>;

function candidateFromAuthored(node: RawNode): GithubCandidate | null {
  const requests = (node.reviewRequests as { nodes?: RawNode[] } | undefined)?.nodes ?? [];
  const reviewer = requests[0]?.requestedReviewer as { __typename?: string; login?: string } | undefined;
  if (!reviewer || reviewer.__typename !== "User" || !reviewer.login) return null;

  return {
    nodeId: node.id as string,
    number: node.number as number,
    title: node.title as string,
    url: node.url as string,
    createdAt: node.createdAt as string,
    counterpartyLogin: reviewer.login,
  };
}

function barePRFromAuthored(node: RawNode): GithubBarePR {
  return {
    nodeId: node.id as string,
    number: node.number as number,
    title: node.title as string,
    url: node.url as string,
    createdAt: node.createdAt as string,
  };
}

function candidateFromAuthored_or_assigned(node: RawNode): GithubCandidate {
  return {
    nodeId: node.id as string,
    number: node.number as number,
    title: node.title as string,
    url: node.url as string,
    createdAt: node.createdAt as string,
    counterpartyLogin: (node.author as { login: string }).login,
  };
}

export function parseGithubSyncCandidates(json: unknown): GithubSyncCandidates {
  const data = (json as { data: RawNode }).data;
  const viewer = data.viewer as { login: string; name: string | null };

  const reviewRequestedNodes = ((data.reviewRequested as { nodes: RawNode[] }).nodes ?? [])
    .map(candidateFromAuthored_or_assigned)
    .filter((c) => c.counterpartyLogin !== viewer.login);

  const assignedIssueNodes = ((data.assignedIssues as { nodes: RawNode[] }).nodes ?? [])
    .map(candidateFromAuthored_or_assigned)
    .filter((c) => c.counterpartyLogin !== viewer.login);

  const authoredNodes = (data.authoredOpenPRs as { nodes: RawNode[] }).nodes ?? [];

  const authoredOpenPRs = authoredNodes
    .map(candidateFromAuthored)
    .filter((c): c is GithubCandidate => c !== null)
    .filter((c) => c.counterpartyLogin !== viewer.login);

  const authoredOpenPRsWithoutReviewer = authoredNodes
    .filter((node) => candidateFromAuthored(node) === null)
    .map(barePRFromAuthored);

  return {
    viewerLogin: viewer.login,
    viewerName: viewer.name,
    reviewRequested: reviewRequestedNodes,
    assignedIssues: assignedIssueNodes,
    authoredOpenPRs,
    authoredOpenPRsWithoutReviewer,
  };
}

export async function fetchGithubSyncCandidates(input: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<GithubSyncCandidates> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SYNC_QUERY }),
  });
  const json = (await response.json()) as { errors?: Array<{ message: string }> };
  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return parseGithubSyncCandidates(json);
}

export interface GithubClosedCheck {
  nodeId: string;
  closedAs: "fulfilled" | "cancelled";
}

const CLOSED_CHECK_QUERY = `
  query HeadroomGithubClosedCheck($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest { id merged state }
      ... on Issue { id state stateReason }
    }
  }
`;

export function parseGithubClosedStates(json: unknown): GithubClosedCheck[] {
  const nodes = ((json as { data: { nodes: (RawNode | null)[] } }).data.nodes ?? []).filter(
    (n): n is RawNode => n !== null,
  );

  const results: GithubClosedCheck[] = [];
  for (const node of nodes) {
    if (typeof node.merged === "boolean") {
      // A PullRequest.
      if (node.merged) results.push({ nodeId: node.id as string, closedAs: "fulfilled" });
      else if (node.state === "CLOSED") results.push({ nodeId: node.id as string, closedAs: "cancelled" });
      continue;
    }
    // An Issue.
    if (node.stateReason === "COMPLETED") results.push({ nodeId: node.id as string, closedAs: "fulfilled" });
    else if (node.stateReason === "NOT_PLANNED") results.push({ nodeId: node.id as string, closedAs: "cancelled" });
    // Still open, or an ambiguous stateReason — omitted rather than guessed
    // (design doc §3 rule 5).
  }
  return results;
}

export async function fetchGithubClosedStates(input: {
  token: string;
  nodeIds: string[];
  fetchImpl?: typeof fetch;
}): Promise<GithubClosedCheck[]> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: CLOSED_CHECK_QUERY, variables: { ids: input.nodeIds } }),
  });
  const json = (await response.json()) as { errors?: Array<{ message: string }> };
  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return parseGithubClosedStates(json);
}
