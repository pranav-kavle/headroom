import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeGoogleHealthCode,
  GOOGLE_HEALTH_STATE_COOKIE,
  resolveGoogleClientCredentials,
} from "@/lib/google-health-oauth";
import { saveGoogleHealthToken } from "@/lib/google-health-token";
import { getOrCreateUser } from "@/lib/auth";
import { resolveRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const user = await getOrCreateUser();
  const origin = resolveRequestOrigin(request);
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const response = NextResponse.redirect(new URL("/controls", origin));
  response.cookies.delete(GOOGLE_HEALTH_STATE_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_HEALTH_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    console.error("[integrations/google-health/callback] missing code, or state didn't match the cookie");
    return response;
  }

  try {
    const { clientId, clientSecret } = resolveGoogleClientCredentials();
    const redirectUri = new URL("/api/v1/integrations/google-health/callback", origin).toString();
    const token = await exchangeGoogleHealthCode({ code, clientId, clientSecret, redirectUri, now: new Date() });

    if (!token.refreshToken) {
      throw new Error(
        "Google did not return a refresh token for Health — expected one since prompt=consent is always set.",
      );
    }

    await saveGoogleHealthToken({
      userId: user.id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });
  } catch (error) {
    console.error("[integrations/google-health/callback]", error);
  }

  return response;
}
