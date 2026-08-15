import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildSlackAuthorizeUrl, resolveSlackClientCredentials, SLACK_STATE_COOKIE } from "@/lib/slack-oauth";
import { getOrCreateUser } from "@/lib/auth";
import { resolveRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const user = await getOrCreateUser();
  const origin = resolveRequestOrigin(request);
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const { clientId } = resolveSlackClientCredentials();
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/v1/integrations/slack/callback", origin).toString();
  const authorizeUrl = buildSlackAuthorizeUrl({ clientId, redirectUri, state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
