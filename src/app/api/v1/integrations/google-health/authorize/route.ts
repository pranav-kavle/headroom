import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildGoogleHealthAuthorizeUrl,
  GOOGLE_HEALTH_STATE_COOKIE,
  resolveGoogleClientCredentials,
} from "@/lib/google-health-oauth";
import { getOrCreateUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { clientId } = resolveGoogleClientCredentials();
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/v1/integrations/google-health/callback", request.url).toString();
  const authorizeUrl = buildGoogleHealthAuthorizeUrl({ clientId, redirectUri, state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GOOGLE_HEALTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
