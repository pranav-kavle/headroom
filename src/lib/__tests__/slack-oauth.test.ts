import { describe, expect, it, vi } from "vitest";
import {
  buildSlackAuthorizeUrl,
  exchangeSlackCode,
  resolveSlackClientCredentials,
  SLACK_USER_SCOPES,
} from "../slack-oauth";

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resolveSlackClientCredentials", () => {
  it("returns both credentials when set", () => {
    expect(
      resolveSlackClientCredentials({ SLACK_CLIENT_ID: "client-123", SLACK_CLIENT_SECRET: "secret-abc" }),
    ).toEqual({ clientId: "client-123", clientSecret: "secret-abc" });
  });

  it("throws when the client id is missing", () => {
    expect(() => resolveSlackClientCredentials({ SLACK_CLIENT_SECRET: "secret-abc" })).toThrow(/SLACK_CLIENT_ID/);
  });

  it("throws when the client secret is missing", () => {
    expect(() => resolveSlackClientCredentials({ SLACK_CLIENT_ID: "client-123" })).toThrow(/SLACK_CLIENT_SECRET/);
  });
});

describe("buildSlackAuthorizeUrl", () => {
  const url = new URL(
    buildSlackAuthorizeUrl({
      clientId: "client-123",
      redirectUri: "https://headroom.example.com/api/v1/integrations/slack/callback",
      state: "nonce-1",
    }),
  );

  it("points at Slack's v2 authorize endpoint", () => {
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
  });

  it("requests the scopes as user_scope, leaving bot scope empty", () => {
    // The distinction is the whole design: a bot token can't read DMs, which
    // is where most commitments are made. Requesting these under `scope`
    // instead would silently yield a bot token that sees almost nothing.
    expect(url.searchParams.get("user_scope")).toBe(SLACK_USER_SCOPES.join(","));
    expect(url.searchParams.get("scope")).toBe("");
  });

  it("includes DM history among the requested scopes", () => {
    expect(SLACK_USER_SCOPES).toContain("im:history");
  });

  it("carries the redirect uri and CSRF state", () => {
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://headroom.example.com/api/v1/integrations/slack/callback",
    );
    expect(url.searchParams.get("state")).toBe("nonce-1");
  });
});

describe("exchangeSlackCode", () => {
  it("posts the code and returns the user token with team and user ids", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        team: { id: "T04AB" },
        authed_user: { id: "U04CD", access_token: "xoxp-real-token" },
      }),
    );

    const token = await exchangeSlackCode({
      code: "code-1",
      clientId: "client-123",
      clientSecret: "secret-abc",
      redirectUri: "https://headroom.example.com/api/v1/integrations/slack/callback",
      fetchImpl,
    });

    expect(token).toEqual({ accessToken: "xoxp-real-token", teamId: "T04AB", slackUserId: "U04CD" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://slack.com/api/oauth.v2.access");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("code")).toBe("code-1");
    expect(body.get("client_id")).toBe("client-123");
    expect(body.get("client_secret")).toBe("secret-abc");
  });

  it("throws when Slack reports ok:false despite HTTP 200", async () => {
    // Slack signals most failures with a 200 and {ok:false}. Trusting
    // response.ok alone is the single most common way a Slack client
    // silently misbehaves — here it would store `undefined` as the token.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: "invalid_code" }));

    await expect(
      exchangeSlackCode({
        code: "bad",
        clientId: "client-123",
        clientSecret: "secret-abc",
        redirectUri: "https://headroom.example.com/cb",
        fetchImpl,
      }),
    ).rejects.toThrow(/invalid_code/);
  });

  it("throws when Slack returns ok:true but no user token", async () => {
    // Happens when the app is installed with bot scopes only — the response
    // looks successful but authed_user carries no access_token.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, team: { id: "T04AB" }, authed_user: { id: "U04CD" } }),
    );

    await expect(
      exchangeSlackCode({
        code: "code-1",
        clientId: "client-123",
        clientSecret: "secret-abc",
        redirectUri: "https://headroom.example.com/cb",
        fetchImpl,
      }),
    ).rejects.toThrow(/user token/i);
  });
});
