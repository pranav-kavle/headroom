import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertConnectorCursor = vi.fn();
const getConnectorCursor = vi.fn();
const createArtifact = vi.fn();
const findArtifactBySourceExternalId = vi.fn();
const resolvePerson = vi.fn();

vi.mock("@headroom/graph", () => ({
  upsertConnectorCursor: (input: unknown) => upsertConnectorCursor(input),
  getConnectorCursor: (userId: string, source: string) => getConnectorCursor(userId, source),
  createArtifact: (input: unknown) => createArtifact(input),
  findArtifactBySourceExternalId: (userId: string, source: string, externalId: string) =>
    findArtifactBySourceExternalId(userId, source, externalId),
  resolvePerson: (input: unknown) => resolvePerson(input),
}));

const listSlackConversations = vi.fn();
const fetchSlackHistory = vi.fn();
const fetchSlackTeamDomain = vi.fn();
const fetchSlackUserName = vi.fn();

vi.mock("../slack/api", () => ({
  listSlackConversations: (input: unknown) => listSlackConversations(input),
  fetchSlackHistory: (input: unknown) => fetchSlackHistory(input),
  fetchSlackTeamDomain: (input: unknown) => fetchSlackTeamDomain(input),
  fetchSlackUserName: (input: unknown) => fetchSlackUserName(input),
}));

const NOW = new Date("2026-08-15T12:00:00.000Z");

function baseInput() {
  return { userId: "u1", token: "xoxp-1", slackUserId: "USELF", now: NOW };
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertConnectorCursor.mockResolvedValue({});
  getConnectorCursor.mockResolvedValue(null);
  findArtifactBySourceExternalId.mockResolvedValue(null);
  createArtifact.mockImplementation(async (input: { externalId: string }) => ({
    id: `art_${input.externalId}`,
  }));
  resolvePerson.mockResolvedValue({ id: "person_1" });
  fetchSlackTeamDomain.mockResolvedValue("headroom-dev");
  fetchSlackUserName.mockResolvedValue("Dana Reed");
  listSlackConversations.mockResolvedValue([{ id: "C1", name: "general", isIm: false }]);
  fetchSlackHistory.mockResolvedValue([]);
});

describe("syncSlack", () => {
  it("writes one artifact per message with a resolvable permalink", async () => {
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1723680001.000100", text: "I'll get you the draft Thursday", user: "U1", subtype: null },
    ]);

    const summary = await syncSlack(baseInput());

    expect(summary.messagesSynced).toBe(1);
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        source: "slack",
        externalId: "C1:1723680001.000100",
        excerpt: "I'll get you the draft Thursday",
        url: "https://headroom-dev.slack.com/archives/C1/p1723680001000100",
        authorPersonId: "person_1",
      }),
    );
  });

  it("converts the Slack ts into the artifact's occurredAt", async () => {
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1723680001.000100", text: "hi", user: "U1", subtype: null },
    ]);

    await syncSlack(baseInput());

    const { occurredAt } = createArtifact.mock.calls[0][0];
    expect(occurredAt).toEqual(new Date(1723680001.0001 * 1000));
  });

  it("skips join/leave noise and empty messages", async () => {
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1.000100", text: "joined the channel", user: "U1", subtype: "channel_join" },
      { ts: "2.000100", text: "   ", user: "U1", subtype: null },
      { ts: "3.000100", text: "real message", user: "U1", subtype: null },
    ]);

    const summary = await syncSlack(baseInput());

    expect(summary.messagesSynced).toBe(1);
    expect(createArtifact).toHaveBeenCalledTimes(1);
    expect(createArtifact.mock.calls[0][0].excerpt).toBe("real message");
  });

  it("does not re-create an artifact that already exists", async () => {
    const { syncSlack } = await import("../slack/sync");
    findArtifactBySourceExternalId.mockResolvedValue({ id: "art_existing" });
    fetchSlackHistory.mockResolvedValue([
      { ts: "1.000100", text: "already ingested", user: "U1", subtype: null },
    ]);

    const summary = await syncSlack(baseInput());

    expect(createArtifact).not.toHaveBeenCalled();
    expect(summary.messagesSynced).toBe(0);
  });

  it("resumes from the stored per-channel cursor", async () => {
    const { syncSlack } = await import("../slack/sync");
    getConnectorCursor.mockResolvedValue({ cursor: { channels: { C1: "1723680000.000100" } } });

    await syncSlack(baseInput());

    expect(fetchSlackHistory).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "C1", oldest: "1723680000.000100" }),
    );
  });

  it("advances the cursor to the newest message seen in each channel", async () => {
    const { syncSlack } = await import("../slack/sync");
    listSlackConversations.mockResolvedValue([
      { id: "C1", name: "general", isIm: false },
      { id: "D1", name: null, isIm: true },
    ]);
    fetchSlackHistory.mockImplementation(async ({ channelId }: { channelId: string }) =>
      channelId === "C1"
        ? [
            { ts: "5.000100", text: "newest", user: "U1", subtype: null },
            { ts: "3.000100", text: "older", user: "U1", subtype: null },
          ]
        : [{ ts: "9.000100", text: "dm", user: "U2", subtype: null }],
    );

    await syncSlack(baseInput());

    const cursorWrite = upsertConnectorCursor.mock.calls.find((call) => call[0].cursor !== undefined);
    expect(cursorWrite?.[0].cursor).toEqual({ channels: { C1: "5.000100", D1: "9.000100" } });
  });

  it("keeps a channel's old cursor when that channel had no new messages", async () => {
    // Otherwise a quiet channel would lose its resume point and re-ingest
    // its whole history on the following sync.
    const { syncSlack } = await import("../slack/sync");
    getConnectorCursor.mockResolvedValue({ cursor: { channels: { C1: "1723680000.000100" } } });
    fetchSlackHistory.mockResolvedValue([]);

    await syncSlack(baseInput());

    const cursorWrite = upsertConnectorCursor.mock.calls.find((call) => call[0].cursor !== undefined);
    expect(cursorWrite?.[0].cursor).toEqual({ channels: { C1: "1723680000.000100" } });
  });

  it("resolves each author once, not once per message", async () => {
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1.000100", text: "one", user: "U1", subtype: null },
      { ts: "2.000100", text: "two", user: "U1", subtype: null },
      { ts: "3.000100", text: "three", user: "U1", subtype: null },
    ]);

    await syncSlack(baseInput());

    expect(fetchSlackUserName).toHaveBeenCalledTimes(1);
    expect(resolvePerson).toHaveBeenCalledTimes(1);
    expect(resolvePerson).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "slack", value: "U1", displayName: "Dana Reed" }),
    );
  });

  it("still stores a message whose author cannot be identified", async () => {
    // Bot posts and integration messages carry no `user`. They're weak
    // commitment sources but dropping them silently loses real context.
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1.000100", text: "deploy finished", user: null, subtype: null },
    ]);

    const summary = await syncSlack(baseInput());

    expect(summary.messagesSynced).toBe(1);
    expect(createArtifact.mock.calls[0][0].authorPersonId).toBeUndefined();
    expect(resolvePerson).not.toHaveBeenCalled();
  });

  it("truncates a very long message rather than storing it whole", async () => {
    const { syncSlack } = await import("../slack/sync");
    fetchSlackHistory.mockResolvedValue([
      { ts: "1.000100", text: "x".repeat(5000), user: "U1", subtype: null },
    ]);

    await syncSlack(baseInput());

    expect(createArtifact.mock.calls[0][0].excerpt).toHaveLength(2000);
  });

  it("marks the connector errored and rethrows when Slack fails", async () => {
    const { syncSlack } = await import("../slack/sync");
    listSlackConversations.mockRejectedValue(new Error("Slack users.conversations failed: invalid_auth"));

    await expect(syncSlack(baseInput())).rejects.toThrow(/invalid_auth/);

    expect(upsertConnectorCursor).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "slack", status: "error" }),
    );
  });
});
