import { beforeEach, describe, expect, it, vi } from "vitest";

const postSlackMessage = vi.fn();
const fetchSlackTeamDomain = vi.fn();
const listSlackConversations = vi.fn();
const fetchSlackUserName = vi.fn();

vi.mock("../slack/api", () => ({
  postSlackMessage: (input: unknown) => postSlackMessage(input),
  fetchSlackTeamDomain: (input: unknown) => fetchSlackTeamDomain(input),
  listSlackConversations: (input: unknown) => listSlackConversations(input),
  fetchSlackUserName: (input: unknown) => fetchSlackUserName(input),
}));

beforeEach(() => {
  vi.clearAllMocks();
  postSlackMessage.mockResolvedValue({ ts: "1723680009.000100", channel: "C1" });
  fetchSlackTeamDomain.mockResolvedValue("headroom-dev");
  listSlackConversations.mockResolvedValue([]);
  fetchSlackUserName.mockResolvedValue(null);
});

describe("SLACK_SEND_TIER", () => {
  it("is tier 2 — outward-facing, one tap, always", async () => {
    // Not tier 1: this leaves the user's account and is not reversible.
    // Pinning it in a test means a later refactor can't quietly downgrade it
    // into something Tier 1 autonomy would execute unattended.
    const { SLACK_SEND_TIER } = await import("../slack/actions");
    expect(SLACK_SEND_TIER).toBe("tier_2");
  });
});

describe("listSlackSendTargets", () => {
  it("returns channels by name, so a send target can be chosen without knowing Slack's ids", async () => {
    const { listSlackSendTargets } = await import("../slack/actions");
    listSlackConversations.mockResolvedValue([
      { id: "C1", name: "engineering", isIm: false, userId: null },
      { id: "C2", name: "design", isIm: false, userId: null },
    ]);

    const targets = await listSlackSendTargets({ token: "xoxp-1" });

    expect(targets).toEqual([
      { id: "C1", name: "engineering", isIm: false },
      { id: "C2", name: "design", isIm: false },
    ]);
    expect(fetchSlackUserName).not.toHaveBeenCalled();
  });

  it("labels a DM with the other person's name, which the conversation list does not carry", async () => {
    const { listSlackSendTargets } = await import("../slack/actions");
    listSlackConversations.mockResolvedValue([{ id: "D1", name: null, isIm: true, userId: "U04AB" }]);
    fetchSlackUserName.mockResolvedValue("Priya Raman");

    const targets = await listSlackSendTargets({ token: "xoxp-1" });

    expect(fetchSlackUserName).toHaveBeenCalledWith(expect.objectContaining({ userId: "U04AB" }));
    expect(targets).toEqual([{ id: "D1", name: "Priya Raman", isIm: true }]);
  });

  it("keeps a DM whose name lookup fails, rather than dropping a reachable target", async () => {
    const { listSlackSendTargets } = await import("../slack/actions");
    listSlackConversations.mockResolvedValue([{ id: "D1", name: null, isIm: true, userId: "U04AB" }]);
    fetchSlackUserName.mockResolvedValue(null);

    expect(await listSlackSendTargets({ token: "xoxp-1" })).toEqual([
      { id: "D1", name: null, isIm: true },
    ]);
  });

  it("bounds how many name lookups one call can make", async () => {
    // users.info is one call per DM against a rate limit. A workspace with 300
    // open DMs would otherwise turn a single tool call into 300 requests.
    const { listSlackSendTargets, SLACK_TARGET_LIMIT } = await import("../slack/actions");
    listSlackConversations.mockResolvedValue(
      Array.from({ length: SLACK_TARGET_LIMIT + 10 }, (_, i) => ({
        id: `D${i}`,
        name: null,
        isIm: true,
        userId: `U${i}`,
      })),
    );

    const targets = await listSlackSendTargets({ token: "xoxp-1" });

    expect(targets).toHaveLength(SLACK_TARGET_LIMIT);
    expect(fetchSlackUserName).toHaveBeenCalledTimes(SLACK_TARGET_LIMIT);
  });
});

describe("sendSlackMessage", () => {
  it("sends the exact channel and text it was handed", async () => {
    const { sendSlackMessage } = await import("../slack/actions");

    await sendSlackMessage({ token: "xoxp-1", channel: "C1", text: "Following up on the draft" });

    expect(postSlackMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", text: "Following up on the draft" }),
    );
  });

  it("returns a permalink to the sent message for the action log", async () => {
    const { sendSlackMessage } = await import("../slack/actions");

    const result = await sendSlackMessage({ token: "xoxp-1", channel: "C1", text: "hi" });

    expect(result).toEqual({
      ts: "1723680009.000100",
      channel: "C1",
      permalink: "https://headroom-dev.slack.com/archives/C1/p1723680009000100",
    });
  });

  it("refuses an empty message instead of posting whitespace", async () => {
    const { sendSlackMessage } = await import("../slack/actions");

    await expect(sendSlackMessage({ token: "xoxp-1", channel: "C1", text: "   " })).rejects.toThrow(/empty/i);
    expect(postSlackMessage).not.toHaveBeenCalled();
  });

  it("refuses a missing channel rather than letting Slack pick one", async () => {
    const { sendSlackMessage } = await import("../slack/actions");

    await expect(sendSlackMessage({ token: "xoxp-1", channel: "", text: "hi" })).rejects.toThrow(/channel/i);
    expect(postSlackMessage).not.toHaveBeenCalled();
  });

  it("propagates a Slack rejection rather than reporting a phantom send", async () => {
    const { sendSlackMessage } = await import("../slack/actions");
    postSlackMessage.mockRejectedValue(new Error("Slack chat.postMessage failed: channel_not_found"));

    await expect(sendSlackMessage({ token: "xoxp-1", channel: "C404", text: "hi" })).rejects.toThrow(
      /channel_not_found/,
    );
  });

  it("still reports the send when only the permalink lookup fails", async () => {
    // The message is already out. Failing here would tell the user their
    // message didn't send when it did — the worse of the two errors.
    const { sendSlackMessage } = await import("../slack/actions");
    fetchSlackTeamDomain.mockRejectedValue(new Error("Slack team.info failed: missing_scope"));

    const result = await sendSlackMessage({ token: "xoxp-1", channel: "C1", text: "hi" });

    expect(result.ts).toBe("1723680009.000100");
    expect(result.permalink).toBeNull();
  });
});
