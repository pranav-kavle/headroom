import { NextResponse } from "next/server";
import { GoogleHealthSyncResponse } from "@headroom/contracts";
import { syncGoogleHealth } from "@headroom/integrations";
import { getOrCreateUser } from "@/lib/auth";
import { resolveGoogleClientCredentials } from "@/lib/google-health-oauth";
import { getValidGoogleHealthAccessToken } from "@/lib/google-health-token";

export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { clientId, clientSecret } = resolveGoogleClientCredentials();
  const now = new Date();
  const token = await getValidGoogleHealthAccessToken({ userId: user.id, now, clientId, clientSecret });
  if (!token) {
    return NextResponse.json({ error: "Google Health is not connected yet." }, { status: 400 });
  }

  try {
    const summary = await syncGoogleHealth({ userId: user.id, token, now });
    return NextResponse.json(GoogleHealthSyncResponse.parse(summary));
  } catch (error) {
    console.error("[integrations/google-health/sync]", error);
    return NextResponse.json({ error: "Google Health sync failed. Try again." }, { status: 502 });
  }
}
