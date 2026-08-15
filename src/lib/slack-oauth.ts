import type { EnvSource } from "./env";

// User-token scopes, not bot scopes — 2026-08-15 spec §2. A bot token only
// sees channels it's explicitly invited to and can never read DMs, which is
// where most commitments are actually made ("yeah, I'll get you that by
// Thursday"). These go in the `user_scope` parameter; putting them in `scope`
// would yield a bot token that reads almost nothing.
export const SLACK_USER_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "users:read",
  "chat:write",
];

// Short-lived cookie carrying the CSRF state nonce between the authorize
// redirect and the callback.
export const SLACK_STATE_COOKIE = "slack_oauth_state";

export function resolveSlackClientCredentials(env: EnvSource = process.env): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = env.SLACK_CLIENT_ID;
  if (!clientId) {
    throw new Error("SLACK_CLIENT_ID is not set — Slack's OAuth flow cannot run.");
  }
  const clientSecret = env.SLACK_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("SLACK_CLIENT_SECRET is not set — Slack's OAuth flow cannot run.");
  }
  return { clientId, clientSecret };
}

export function buildSlackAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("user_scope", SLACK_USER_SCOPES.join(","));
  // Explicitly empty: we want no bot user at all, so nothing is installed
  // into the workspace beyond the user grant.
  url.searchParams.set("scope", "");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export interface ExchangedSlackToken {
  accessToken: string;
  teamId: string;
  slackUserId: string;
}

interface SlackOAuthResponse {
  ok?: boolean;
  error?: string;
  team?: { id?: string };
  authed_user?: { id?: string; access_token?: string };
}

export async function exchangeSlackCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<ExchangedSlackToken> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }).toString(),
  });

  const json = (await response.json()) as SlackOAuthResponse;

  // Slack answers most failures with HTTP 200 and {ok:false}, so response.ok
  // is not a sufficient check — trusting it would store `undefined` as a token.
  if (!json.ok) {
    throw new Error(`Slack token exchange failed: ${json.error ?? response.statusText}`);
  }

  const accessToken = json.authed_user?.access_token;
  const slackUserId = json.authed_user?.id;
  const teamId = json.team?.id;

  if (!accessToken || !slackUserId || !teamId) {
    // Happens when the app is installed with bot scopes only: ok:true, but
    // authed_user carries no user token.
    throw new Error("Slack returned no user token — check that the app requests user_scope, not bot scope.");
  }

  return { accessToken, teamId, slackUserId };
}
