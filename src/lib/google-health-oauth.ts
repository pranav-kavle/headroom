import type { EnvSource } from "./env";

// Google Health's own OAuth flow, independent of Clerk's Google social
// connection — 2026-08-14 spec §9a. Health's API rejects any token carrying
// a scope outside its own family (including Clerk's baseline openid/email/
// profile), so this flow requests only these two and nothing else.
export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
];

// Short-lived cookie carrying the CSRF state nonce between the authorize
// redirect and the callback.
export const GOOGLE_HEALTH_STATE_COOKIE = "google_health_oauth_state";

export function resolveGoogleClientCredentials(env: EnvSource = process.env): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set — Google Health's OAuth flow cannot run.");
  }
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not set — Google Health's OAuth flow cannot run.");
  }
  return { clientId, clientSecret };
}

export function buildGoogleHealthAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_HEALTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);
  return url.toString();
}

interface GoogleTokenErrorBody {
  error?: string;
  error_description?: string;
}

function tokenErrorMessage(prefix: string, response: Response, json: GoogleTokenErrorBody): string {
  return `${prefix}: ${json.error_description ?? json.error ?? response.statusText}`;
}

export interface ExchangedGoogleHealthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export async function exchangeGoogleHealthCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<ExchangedGoogleHealthToken> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const json = (await response.json()) as GoogleTokenErrorBody & {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(tokenErrorMessage("Google token exchange failed", response, json));
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(input.now.getTime() + (json.expires_in ?? 3600) * 1000),
  };
}

export interface RefreshedGoogleHealthToken {
  accessToken: string;
  expiresAt: Date;
}

export async function refreshGoogleHealthToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<RefreshedGoogleHealthToken> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  const json = (await response.json()) as GoogleTokenErrorBody & { access_token?: string; expires_in?: number };
  if (!response.ok || !json.access_token) {
    throw new Error(tokenErrorMessage("Google token refresh failed", response, json));
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(input.now.getTime() + (json.expires_in ?? 3600) * 1000),
  };
}
