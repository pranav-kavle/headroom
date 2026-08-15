import { beforeEach, describe, expect, it, vi } from "vitest";
import { engineTools, type EngineContext } from "../tools";

const NOW = new Date("2026-08-15T09:00:00Z");

const syncSlack = vi.fn();
const listSlackSendTargets = vi.fn();
const sendSlackMessage = vi.fn();

vi.mock("@headroom/integrations", () => ({
  syncSlack: (input: unknown) => syncSlack(input),
  listSlackSendTargets: (input: unknown) => listSlackSendTargets(input),
  sendSlackMessage: (input: unknown) => sendSlackMessage(input),
}));

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

const SLACK_CREDENTIALS = { accessToken: "xoxp-1", slackUserId: "U_ME" };

const MESSAGE = {
  id: "art_1",
  occurredAt: new Date("2026-08-15T04:12:00Z"),
  excerpt: "can you get me the deck by Thursday",
  url: "https://headroom-dev.slack.com/archives/C1/p1723680000123456",
  authorPerson: { displayName: "Priya Raman" },
};

beforeEach(() => {
  vi.clearAllMocks();
  syncSlack.mockResolvedValue({ channelsScanned: 3, messagesSynced: 7 });
  listSlackSendTargets.mockResolvedValue([]);
  sendSlackMessage.mockResolvedValue({ ts: "1723680009.000100", channel: "C1", permalink: null });
});

describe("check_slack handler", () => {
  it("refuses when Slack is not connected, rather than reporting an empty workspace", async () => {
    await expect(toolNamed("check_slack").handler({}, context())).rejects.toThrow(/not connected/i);
    expect(syncSlack).not.toHaveBeenCalled();
  });

  it("triggers a fresh sync before reading, so the answer is not stale", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await toolNamed("check_slack").handler(
      {},
      context({ slackCredentials: SLACK_CREDENTIALS, fetchImpl, listRecentSlackMessages: async () => [] }),
    );

    expect(syncSlack).toHaveBeenCalledWith({
      userId: "u1",
      token: "xoxp-1",
      slackUserId: "U_ME",
      now: NOW,
      fetchImpl,
    });
  });

  it("returns each message with the id, quote, time and link a claim needs to be citable", async () => {
    const result = await toolNamed("check_slack").handler(
      {},
      context({ slackCredentials: SLACK_CREDENTIALS, listRecentSlackMessages: async () => [MESSAGE] }),
    );

    expect(result).toEqual({
      channelsScanned: 3,
      messagesSynced: 7,
      recentMessages: [
        {
          artifactId: "art_1",
          author: "Priya Raman",
          occurredAt: "2026-08-15T04:12:00.000Z",
          quote: "can you get me the deck by Thursday",
          url: "https://headroom-dev.slack.com/archives/C1/p1723680000123456",
        },
      ],
    });
  });

  it("reads back only as many messages as it asked the graph for", async () => {
    let askedFor: { userId?: string; limit?: number } = {};
    await toolNamed("check_slack").handler(
      {},
      context({
        slackCredentials: SLACK_CREDENTIALS,
        listRecentSlackMessages: async (userId, limit) => {
          askedFor = { userId, limit };
          return [];
        },
      }),
    );

    expect(askedFor.userId).toBe("u1");
    expect(askedFor.limit).toBeGreaterThan(0);
    expect(askedFor.limit).toBeLessThanOrEqual(50);
  });

  it("names an unattributed message rather than inventing an author", async () => {
    const result = (await toolNamed("check_slack").handler(
      {},
      context({
        slackCredentials: SLACK_CREDENTIALS,
        listRecentSlackMessages: async () => [{ ...MESSAGE, authorPerson: null, url: null }],
      }),
    )) as { recentMessages: Array<{ author: string | null; url: string | null }> };

    expect(result.recentMessages[0].author).toBeNull();
    expect(result.recentMessages[0].url).toBeNull();
  });

  it("still reports the sync when the engine context cannot read messages back", async () => {
    // The read-back accessor is optional on the context, like every other
    // graph accessor. A context without one must not fail the whole turn.
    const result = await toolNamed("check_slack").handler({}, context({ slackCredentials: SLACK_CREDENTIALS }));

    expect(result).toEqual({ channelsScanned: 3, messagesSynced: 7, recentMessages: [] });
  });
});

describe("list_slack_channels handler", () => {
  it("refuses when Slack is not connected", async () => {
    await expect(toolNamed("list_slack_channels").handler({}, context())).rejects.toThrow(/not connected/i);
    expect(listSlackSendTargets).not.toHaveBeenCalled();
  });

  it("returns the channels and DMs a message could be sent to", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    listSlackSendTargets.mockResolvedValue([
      { id: "C1", name: "engineering", isIm: false },
      { id: "D1", name: "Priya Raman", isIm: true },
    ]);

    const result = await toolNamed("list_slack_channels").handler(
      {},
      context({ slackCredentials: SLACK_CREDENTIALS, fetchImpl }),
    );

    expect(listSlackSendTargets).toHaveBeenCalledWith({ token: "xoxp-1", fetchImpl });
    expect(result).toEqual({
      channels: [
        { id: "C1", name: "engineering", isIm: false },
        { id: "D1", name: "Priya Raman", isIm: true },
      ],
    });
  });
});

describe("send_slack_message handler", () => {
  it("sends the exact channel and text it was given", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const result = await toolNamed("send_slack_message").handler(
      { channel: "C1", text: "Sending the deck over now" },
      context({ slackCredentials: SLACK_CREDENTIALS, fetchImpl }),
    );

    expect(sendSlackMessage).toHaveBeenCalledWith({
      token: "xoxp-1",
      channel: "C1",
      text: "Sending the deck over now",
      fetchImpl,
    });
    expect(result).toEqual({ ts: "1723680009.000100", channel: "C1", permalink: null });
  });

  it("refuses when Slack is not connected", async () => {
    await expect(
      toolNamed("send_slack_message").handler({ channel: "C1", text: "hi" }, context()),
    ).rejects.toThrow(/not connected/i);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("requires both a channel and text, rather than letting Slack choose either", async () => {
    const ctx = context({ slackCredentials: SLACK_CREDENTIALS });

    await expect(toolNamed("send_slack_message").handler({ text: "hi" }, ctx)).rejects.toThrow(/channel/i);
    await expect(toolNamed("send_slack_message").handler({ channel: "C1" }, ctx)).rejects.toThrow(/text/i);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });
});

describe("Slack tool registration", () => {
  it("declares the send as tier_2 — outward-facing, never unattended", () => {
    // The tier lives on the tool, where the model cannot reach it (core rule
    // 3). If this ever reads undefined, the loop's gate stops running for the
    // one action here that leaves the user's account.
    expect(toolNamed("send_slack_message").tier).toBe("tier_2");
  });

  it("leaves the two reads untiered, and marks everything Slack as external", () => {
    for (const name of ["check_slack", "list_slack_channels"]) {
      expect(toolNamed(name).tier, name).toBeUndefined();
    }
    for (const name of ["check_slack", "list_slack_channels", "send_slack_message"]) {
      expect(toolNamed(name).external, name).toBe(true);
    }
  });

  it("marks check_slack as a claim about the user's life, so the verifier arms", () => {
    expect(toolNamed("check_slack").aboutUser).toBe(true);
  });
});
