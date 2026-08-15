import { describe, expect, it, vi } from "vitest";
import {
  fetchSlackHistory,
  fetchSlackTeamDomain,
  fetchSlackUserName,
  listSlackConversations,
  postSlackMessage,
} from "../slack/api";

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function rateLimited(retryAfter: string) {
  return new Response(JSON.stringify({ ok: false, error: "ratelimited" }), {
    status: 429,
    headers: { "Retry-After": retryAfter },
  });
}

function bodyOf(call: unknown[]): URLSearchParams {
  return new URLSearchParams((call[1] as RequestInit).body as string);
}

describe("listSlackConversations", () => {
  it("requests DMs and private channels, not just public ones", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ channels: [], response_metadata: {} }));

    await listSlackConversations({ token: "xoxp-1", fetchImpl });

    const types = bodyOf(fetchImpl.mock.calls[0]).get("types") ?? "";
    // Omitting `im` here is the silent failure mode that would gut the whole
    // integration: DMs are where most commitments are actually made.
    expect(types).toContain("im");
    expect(types).toContain("mpim");
    expect(types).toContain("private_channel");
    expect(types).toContain("public_channel");
  });

  it("follows next_cursor until Slack stops returning one", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          channels: [{ id: "C1", name: "general", is_im: false }],
          response_metadata: { next_cursor: "page2" },
        }),
      )
      .mockResolvedValueOnce(
        ok({ channels: [{ id: "D1", is_im: true }], response_metadata: { next_cursor: "" } }),
      );

    const conversations = await listSlackConversations({ token: "xoxp-1", fetchImpl });

    expect(conversations).toEqual([
      { id: "C1", name: "general", isIm: false, userId: null },
      { id: "D1", name: null, isIm: true, userId: null },
    ]);
    expect(bodyOf(fetchImpl.mock.calls[1]).get("cursor")).toBe("page2");
  });

  it("keeps the other person's user id on a DM, which has no name to show", async () => {
    // A DM comes back with is_im and a `user`, never a `name`. Dropping the
    // user id leaves the conversation unlabelable — you would see an opaque
    // channel id where a person's name belongs.
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ channels: [{ id: "D1", is_im: true, user: "U04AB" }], response_metadata: {} }));

    const conversations = await listSlackConversations({ token: "xoxp-1", fetchImpl });

    expect(conversations).toEqual([{ id: "D1", name: null, isIm: true, userId: "U04AB" }]);
  });

  it("throws when Slack reports ok:false on an HTTP 200", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), { status: 200 }));

    await expect(listSlackConversations({ token: "revoked", fetchImpl })).rejects.toThrow(/invalid_auth/);
  });
});

describe("fetchSlackHistory", () => {
  it("passes the cursor timestamp as `oldest` so syncs stay incremental", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ messages: [] }));

    await fetchSlackHistory({ token: "xoxp-1", channelId: "C1", oldest: "1723680000.000100", fetchImpl });

    const body = bodyOf(fetchImpl.mock.calls[0]);
    expect(body.get("channel")).toBe("C1");
    expect(body.get("oldest")).toBe("1723680000.000100");
  });

  it("returns messages with subtype and user preserved", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({
        messages: [
          { ts: "1723680001.000100", text: "I'll get you the draft Thursday", user: "U1" },
          { ts: "1723680002.000100", text: "joined", user: "U2", subtype: "channel_join" },
        ],
      }),
    );

    const messages = await fetchSlackHistory({ token: "xoxp-1", channelId: "C1", fetchImpl });

    expect(messages).toEqual([
      { ts: "1723680001.000100", text: "I'll get you the draft Thursday", user: "U1", subtype: null },
      { ts: "1723680002.000100", text: "joined", user: "U2", subtype: "channel_join" },
    ]);
  });

  it("waits for Retry-After and retries when rate limited", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(rateLimited("3"))
      .mockResolvedValueOnce(ok({ messages: [{ ts: "1.0", text: "hi", user: "U1" }] }));

    const messages = await fetchSlackHistory({ token: "xoxp-1", channelId: "C1", fetchImpl, sleepImpl });

    expect(sleepImpl).toHaveBeenCalledWith(3000);
    expect(messages).toHaveLength(1);
  });

  it("gives up after repeated rate limiting rather than looping forever", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(rateLimited("1"));

    await expect(
      fetchSlackHistory({ token: "xoxp-1", channelId: "C1", fetchImpl, sleepImpl }),
    ).rejects.toThrow(/rate limit/i);
  });
});

describe("fetchSlackTeamDomain", () => {
  it("returns the workspace subdomain", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ team: { id: "T1", domain: "headroom-dev" } }));

    expect(await fetchSlackTeamDomain({ token: "xoxp-1", fetchImpl })).toBe("headroom-dev");
  });

  it("throws when no domain comes back, rather than building broken permalinks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ team: { id: "T1" } }));

    await expect(fetchSlackTeamDomain({ token: "xoxp-1", fetchImpl })).rejects.toThrow(/permalink/i);
  });
});

describe("fetchSlackUserName", () => {
  it("prefers the real name over the handle", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ user: { real_name: "Dana Reed", name: "dana" } }));

    expect(await fetchSlackUserName({ token: "xoxp-1", userId: "U1", fetchImpl })).toBe("Dana Reed");
  });

  it("returns null rather than throwing when the user can't be read", async () => {
    // A deactivated or out-of-workspace author shouldn't fail the whole sync.
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "user_not_found" }), { status: 200 }));

    expect(await fetchSlackUserName({ token: "xoxp-1", userId: "U404", fetchImpl })).toBeNull();
  });
});

describe("postSlackMessage", () => {
  it("posts the exact channel and text it was given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ ts: "1723680009.000100", channel: "C1" }));

    const result = await postSlackMessage({
      token: "xoxp-1",
      channel: "C1",
      text: "Following up on the draft",
      fetchImpl,
    });

    const body = bodyOf(fetchImpl.mock.calls[0]);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://slack.com/api/chat.postMessage");
    expect(body.get("channel")).toBe("C1");
    expect(body.get("text")).toBe("Following up on the draft");
    expect(result).toEqual({ ts: "1723680009.000100", channel: "C1" });
  });

  it("throws when Slack rejects the post", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), { status: 200 }));

    await expect(
      postSlackMessage({ token: "xoxp-1", channel: "C404", text: "hi", fetchImpl }),
    ).rejects.toThrow(/channel_not_found/);
  });
});
