import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureSelfPerson = vi.fn();
const resolvePerson = vi.fn();
const findArtifactBySourceExternalId = vi.fn();
const createArtifact = vi.fn();
const findCommitmentBySourceArtifact = vi.fn();
const createCommitment = vi.fn();
const closeCommitment = vi.fn();
const listCommitments = vi.fn();
const upsertConnectorCursor = vi.fn();
const upsertTrackedPullRequest = vi.fn();
const listOpenTrackedPullRequests = vi.fn();
const closeTrackedPullRequest = vi.fn();

vi.mock("@headroom/graph", () => ({
  ensureSelfPerson: (input: unknown) => ensureSelfPerson(input),
  resolvePerson: (input: unknown) => resolvePerson(input),
  findArtifactBySourceExternalId: (...args: unknown[]) => findArtifactBySourceExternalId(...args),
  createArtifact: (input: unknown) => createArtifact(input),
  findCommitmentBySourceArtifact: (...args: unknown[]) => findCommitmentBySourceArtifact(...args),
  createCommitment: (input: unknown) => createCommitment(input),
  closeCommitment: (input: unknown) => closeCommitment(input),
  listCommitments: (userId: string) => listCommitments(userId),
  upsertConnectorCursor: (input: unknown) => upsertConnectorCursor(input),
  upsertTrackedPullRequest: (input: unknown) => upsertTrackedPullRequest(input),
  listOpenTrackedPullRequests: (userId: string) => listOpenTrackedPullRequests(userId),
  closeTrackedPullRequest: (input: unknown) => closeTrackedPullRequest(input),
}));

const CANDIDATES = {
  viewerLogin: "pranav-kavle",
  viewerName: "Pranav Kavle",
  reviewRequested: [
    {
      nodeId: "PR_1",
      number: 10,
      title: "Add retries",
      url: "https://github.com/acme/repo/pull/10",
      createdAt: "2026-08-10T00:00:00Z",
      counterpartyLogin: "mrodriguez",
    },
  ],
  assignedIssues: [],
  authoredOpenPRs: [],
  authoredOpenPRsWithoutReviewer: [],
};

const fetchGithubSyncCandidates = vi.fn();
const fetchGithubClosedStates = vi.fn();
vi.mock("../api", () => ({
  fetchGithubSyncCandidates: (input: unknown) => fetchGithubSyncCandidates(input),
  fetchGithubClosedStates: (input: unknown) => fetchGithubClosedStates(input),
}));

beforeEach(() => {
  vi.clearAllMocks();
  upsertConnectorCursor.mockResolvedValue({});
  ensureSelfPerson.mockResolvedValue({ id: "self-1" });
  fetchGithubSyncCandidates.mockResolvedValue(CANDIDATES);
  fetchGithubClosedStates.mockResolvedValue([]);
  listCommitments.mockResolvedValue([]);
  upsertTrackedPullRequest.mockResolvedValue({});
  listOpenTrackedPullRequests.mockResolvedValue([]);
  closeTrackedPullRequest.mockResolvedValue({});
});

describe("syncGithub", () => {
  it("creates a person, an artifact, and a commitment for a new review request", async () => {
    findArtifactBySourceExternalId.mockResolvedValue(null);
    createArtifact.mockResolvedValue({ id: "artifact-1" });
    findCommitmentBySourceArtifact.mockResolvedValue(null);
    resolvePerson.mockResolvedValue({ id: "person-1" });
    createCommitment.mockResolvedValue({ id: "commitment-1" });

    const { syncGithub } = await import("../sync");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(result).toEqual({ created: 1, closed: 0, openPRsWithoutReviewer: [] });
    expect(ensureSelfPerson).toHaveBeenCalledWith({
      userId: "u1",
      displayName: "Pranav Kavle",
      githubLogin: "pranav-kavle",
    });
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", source: "github", externalId: "PR_1" }),
    );
    expect(resolvePerson).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", kind: "github", value: "mrodriguez", confidence: 1 }),
    );
    expect(createCommitment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        direction: "owed_by_me",
        counterpartyPersonId: "person-1",
        sourceArtifactId: "artifact-1",
        duePrecision: "vague",
        dueAt: null,
      }),
    );
  });

  it("reuses the existing artifact and skips creating a duplicate commitment", async () => {
    findArtifactBySourceExternalId.mockResolvedValue({ id: "artifact-1" });
    findCommitmentBySourceArtifact.mockResolvedValue({ id: "commitment-1" });

    const { syncGithub } = await import("../sync");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(result).toEqual({ created: 0, closed: 0, openPRsWithoutReviewer: [] });
    expect(createArtifact).not.toHaveBeenCalled();
    expect(createCommitment).not.toHaveBeenCalled();
  });

  it("closes a commitment whose PR is no longer in the open results", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listCommitments.mockResolvedValue([
      {
        id: "commitment-stale",
        status: "open",
        sourceArtifactId: "artifact-1",
        sourceArtifact: { source: "github", externalId: "PR_1" },
      },
    ]);
    fetchGithubClosedStates.mockResolvedValue([{ nodeId: "PR_1", closedAs: "fulfilled" }]);
    closeCommitment.mockResolvedValue({ id: "commitment-stale" });

    const { syncGithub } = await import("../sync");
    const now = new Date("2026-08-14T00:00:00Z");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now });

    expect(result).toEqual({ created: 0, closed: 1, openPRsWithoutReviewer: [] });
    expect(closeCommitment).toHaveBeenCalledWith({
      id: "commitment-stale",
      userId: "u1",
      status: "fulfilled",
      reason: "Closed on GitHub.",
      artifactId: "artifact-1",
      at: now,
    });
  });

  it("leaves a stale commitment open when GitHub's state is still ambiguous", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listCommitments.mockResolvedValue([
      {
        id: "commitment-stale",
        status: "open",
        sourceArtifactId: "artifact-1",
        sourceArtifact: { source: "github", externalId: "PR_1" },
      },
    ]);
    fetchGithubClosedStates.mockResolvedValue([]);

    const { syncGithub } = await import("../sync");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now: new Date() });

    expect(result).toEqual({ created: 0, closed: 0, openPRsWithoutReviewer: [] });
    expect(closeCommitment).not.toHaveBeenCalled();
  });

  it("creates an artifact but no commitment for an authored PR with no reviewer, and reports it in the summary", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({
      ...CANDIDATES,
      reviewRequested: [],
      authoredOpenPRsWithoutReviewer: [
        {
          nodeId: "PR_3",
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
    findArtifactBySourceExternalId.mockResolvedValue(null);
    createArtifact.mockResolvedValue({ id: "artifact-3" });

    const { syncGithub } = await import("../sync");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", source: "github", externalId: "PR_3" }),
    );
    expect(resolvePerson).not.toHaveBeenCalled();
    expect(createCommitment).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      closed: 0,
      openPRsWithoutReviewer: [
        {
          // Without this the PR is describable but not actionable — the
          // GitHub write actions resolve through the artifact.
          artifactId: "artifact-3",
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
  });

  it("reports the existing artifact's id for a reviewer-less PR seen on an earlier sync", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({
      ...CANDIDATES,
      reviewRequested: [],
      authoredOpenPRsWithoutReviewer: [
        {
          nodeId: "PR_3",
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
    findArtifactBySourceExternalId.mockResolvedValue({ id: "artifact-existing" });

    const { syncGithub } = await import("../sync");
    const result = await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(createArtifact).not.toHaveBeenCalled();
    expect(result.openPRsWithoutReviewer[0].artifactId).toBe("artifact-existing");
  });

  it("tracks a reviewer-less PR as open so the UI has something to render", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({
      ...CANDIDATES,
      reviewRequested: [],
      authoredOpenPRsWithoutReviewer: [
        {
          nodeId: "PR_3",
          number: 80,
          title: "Slack integration",
          url: "https://github.com/acme/repo/pull/80",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
    findArtifactBySourceExternalId.mockResolvedValue(null);
    createArtifact.mockResolvedValue({ id: "artifact-3" });

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(upsertTrackedPullRequest).toHaveBeenCalledWith({
      userId: "u1",
      artifactId: "artifact-3",
      number: 80,
      lastSeenAt: new Date("2026-08-14T00:00:00Z"),
    });
  });

  it("tracks an authored PR that does have a reviewer, so gaining one doesn't look like closing", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({
      ...CANDIDATES,
      reviewRequested: [],
      authoredOpenPRs: [
        {
          nodeId: "PR_4",
          number: 81,
          title: "Reviewed PR",
          url: "https://github.com/acme/repo/pull/81",
          createdAt: "2026-08-13T00:00:00Z",
          counterpartyLogin: "mrodriguez",
        },
      ],
    });
    findArtifactBySourceExternalId.mockResolvedValue(null);
    createArtifact.mockResolvedValue({ id: "artifact-4" });
    findCommitmentBySourceArtifact.mockResolvedValue(null);
    resolvePerson.mockResolvedValue({ id: "person-1" });
    listOpenTrackedPullRequests.mockResolvedValue([
      { artifactId: "artifact-4", artifact: { externalId: "PR_4" } },
    ]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(upsertTrackedPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ artifactId: "artifact-4", number: 81 }),
    );
    // Seen this sync, so it must not be checked for closure.
    expect(fetchGithubClosedStates).not.toHaveBeenCalled();
    expect(closeTrackedPullRequest).not.toHaveBeenCalled();
  });

  it("closes a tracked PR that GitHub reports merged", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listOpenTrackedPullRequests.mockResolvedValue([
      { artifactId: "artifact-gone", artifact: { externalId: "PR_GONE" } },
    ]);
    fetchGithubClosedStates.mockResolvedValue([{ nodeId: "PR_GONE", closedAs: "fulfilled" }]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(closeTrackedPullRequest).toHaveBeenCalledWith({
      artifactId: "artifact-gone",
      state: "merged",
      at: new Date("2026-08-14T00:00:00Z"),
    });
  });

  it("records a tracked PR closed without merging as closed, not merged", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listOpenTrackedPullRequests.mockResolvedValue([
      { artifactId: "artifact-gone", artifact: { externalId: "PR_GONE" } },
    ]);
    fetchGithubClosedStates.mockResolvedValue([{ nodeId: "PR_GONE", closedAs: "cancelled" }]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(closeTrackedPullRequest).toHaveBeenCalledWith(expect.objectContaining({ state: "closed" }));
  });

  // §3 rule 5 — when the engine can't determine something, it doesn't guess.
  it("leaves a tracked PR open when GitHub's state is ambiguous", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listOpenTrackedPullRequests.mockResolvedValue([
      { artifactId: "artifact-gone", artifact: { externalId: "PR_GONE" } },
    ]);
    fetchGithubClosedStates.mockResolvedValue([]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(closeTrackedPullRequest).not.toHaveBeenCalled();
  });

  it("doesn't run a closed-state check for a commitment whose PR merely lost its reviewer", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({
      ...CANDIDATES,
      reviewRequested: [],
      authoredOpenPRsWithoutReviewer: [
        {
          nodeId: "PR_1",
          number: 10,
          title: "Add retries",
          url: "https://github.com/acme/repo/pull/10",
          createdAt: "2026-08-10T00:00:00Z",
        },
      ],
    });
    findArtifactBySourceExternalId.mockResolvedValue({ id: "artifact-1" });
    listCommitments.mockResolvedValue([
      {
        id: "commitment-1",
        status: "open",
        sourceArtifactId: "artifact-1",
        sourceArtifact: { source: "github", externalId: "PR_1" },
      },
    ]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(fetchGithubClosedStates).not.toHaveBeenCalled();
    expect(closeCommitment).not.toHaveBeenCalled();
  });

  it("ignores commitments from other sources when checking for stale ones", async () => {
    fetchGithubSyncCandidates.mockResolvedValue({ ...CANDIDATES, reviewRequested: [] });
    listCommitments.mockResolvedValue([
      {
        id: "voice-commitment",
        status: "open",
        sourceArtifactId: "artifact-voice",
        sourceArtifact: { source: "voice_note", externalId: null },
      },
    ]);

    const { syncGithub } = await import("../sync");
    await syncGithub({ userId: "u1", token: "gho_test", now: new Date() });

    expect(fetchGithubClosedStates).not.toHaveBeenCalled();
    expect(closeCommitment).not.toHaveBeenCalled();
  });
});
