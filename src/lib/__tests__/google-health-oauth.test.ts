import { describe, expect, it } from "vitest";
import {
  buildGoogleHealthAuthorizeUrl,
  exchangeGoogleHealthCode,
  GOOGLE_HEALTH_SCOPES,
  refreshGoogleHealthToken,
  resolveGoogleClientCredentials,
} from "../google-health-oauth";

describe("resolveGoogleClientCredentials", () => {
  it("returns the id and secret from the given env source", () => {
    const result = resolveGoogleClientCredentials({
      GOOGLE_CLIENT_ID: "client-123",
      GOOGLE_CLIENT_SECRET: "secret-abc",
    });
    expect(result).toEqual({ clientId: "client-123", clientSecret: "secret-abc" });
  });

  it("throws a named error when the client id is missing", () => {
    expect(() => resolveGoogleClientCredentials({ GOOGLE_CLIENT_SECRET: "secret-abc" })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
  });

  it("throws a named error when the client secret is missing", () => {
    expect(() => resolveGoogleClientCredentials({ GOOGLE_CLIENT_ID: "client-123" })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    );
  });
});

describe("buildGoogleHealthAuthorizeUrl", () => {
  it("requests only the two Health scopes, offline access, and forced consent", () => {
    const url = new URL(
      buildGoogleHealthAuthorizeUrl({
        clientId: "client-123",
        redirectUri: "https://app.example.com/api/v1/integrations/google-health/callback",
        state: "nonce-abc",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/v1/integrations/google-health/callback",
    );
    expect(url.searchParams.get("scope")).toBe(GOOGLE_HEALTH_SCOPES.join(" "));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("nonce-abc");
  });

  it("never includes calendar or any non-Health scope", () => {
    const url = new URL(
      buildGoogleHealthAuthorizeUrl({ clientId: "c", redirectUri: "https://x/y", state: "s" }),
    );
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).not.toContain("calendar");
    expect(scope).not.toContain("openid");
  });
});

describe("exchangeGoogleHealthCode", () => {
  it("posts the code and returns the token with a computed expiry", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), body: init!.body as string });
      return new Response(
        JSON.stringify({ access_token: "ya29.new", refresh_token: "1//new-refresh", expires_in: 3600 }),
      );
    };

    const result = await exchangeGoogleHealthCode({
      code: "auth-code-1",
      clientId: "client-123",
      clientSecret: "secret-abc",
      redirectUri: "https://app.example.com/callback",
      now: new Date("2026-08-15T00:00:00.000Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toEqual({
      accessToken: "ya29.new",
      refreshToken: "1//new-refresh",
      expiresAt: new Date("2026-08-15T01:00:00.000Z"),
    });
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0].body).toContain("code=auth-code-1");
    expect(calls[0].body).toContain("grant_type=authorization_code");
  });

  it("throws a named error when Google rejects the code", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "Bad code" }), { status: 400 });

    await expect(
      exchangeGoogleHealthCode({
        code: "bad",
        clientId: "c",
        clientSecret: "s",
        redirectUri: "https://x",
        now: new Date(),
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow(/Bad code/);
  });
});

describe("refreshGoogleHealthToken", () => {
  it("posts the refresh token and returns a new access token with expiry", async () => {
    const calls: Array<{ body: string }> = [];
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      calls.push({ body: init!.body as string });
      return new Response(JSON.stringify({ access_token: "ya29.refreshed", expires_in: 3600 }));
    };

    const result = await refreshGoogleHealthToken({
      refreshToken: "1//existing-refresh",
      clientId: "client-123",
      clientSecret: "secret-abc",
      now: new Date("2026-08-15T00:00:00.000Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toEqual({ accessToken: "ya29.refreshed", expiresAt: new Date("2026-08-15T01:00:00.000Z") });
    expect(calls[0].body).toContain("grant_type=refresh_token");
    expect(calls[0].body).toContain("refresh_token=1%2F%2Fexisting-refresh");
  });

  it("throws a named error when Google rejects the refresh token", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token expired or revoked" }), {
        status: 400,
      });

    await expect(
      refreshGoogleHealthToken({
        refreshToken: "bad",
        clientId: "c",
        clientSecret: "s",
        now: new Date(),
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow(/Token expired or revoked/);
  });
});
