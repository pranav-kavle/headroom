import { NextResponse, type NextRequest } from "next/server";
import { exchangeSlackCode, resolveSlackClientCredentials, SLACK_STATE_COOKIE } from "@/lib/slack-oauth";
import { saveSlackToken } from "@/lib/slack-token";
import { getOrCreateUser } from "@/lib/auth";
import { resolveRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const user = await getOrCreateUser();
  const origin = resolveRequestOrigin(request);
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const response = NextResponse.redirect(new URL("/controls", origin));
  response.cookies.delete(SLACK_STATE_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(SLACK_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    console.error("[integrations/slack/callback] missing code, or state didn't match the cookie");
    return response;
  }

  try {
    const { clientId, clientSecret } = resolveSlackClientCredentials();
    const redirectUri = new URL("/api/v1/integrations/slack/callback", origin).toString();
    const token = await exchangeSlackCode({ code, clientId, clientSecret, redirectUri });

    await saveSlackToken({
      userId: user.id,
      accessToken: token.accessToken,
      teamId: token.teamId,
      slackUserId: token.slackUserId,
    });
  } catch (error) {
    console.error("[integrations/slack/callback]", error);
  }

  return response;
}
