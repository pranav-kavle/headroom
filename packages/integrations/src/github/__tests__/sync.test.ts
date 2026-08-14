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

    expect(result).toEqual({ created: 1, closed: 0 });
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

    expect(result).toEqual({ created: 0, closed: 0 });
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

    expect(result).toEqual({ created: 0, closed: 1 });
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

    expect(result).toEqual({ created: 0, closed: 0 });
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
