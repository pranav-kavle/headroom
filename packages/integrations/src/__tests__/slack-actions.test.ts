import { beforeEach, describe, expect, it, vi } from "vitest";

const postSlackMessage = vi.fn();
const fetchSlackTeamDomain = vi.fn();

vi.mock("../slack/api", () => ({
  postSlackMessage: (input: unknown) => postSlackMessage(input),
  fetchSlackTeamDomain: (input: unknown) => fetchSlackTeamDomain(input),
}));

beforeEach(() => {
  vi.clearAllMocks();
  postSlackMessage.mockResolvedValue({ ts: "1723680009.000100", channel: "C1" });
  fetchSlackTeamDomain.mockResolvedValue("headroom-dev");
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
