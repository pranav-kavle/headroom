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
    // Google's message is the whole diagnosis here — a disabled API, a
    // rejected filter, and an unexpected data-point shape are all the same
    // generic 502 otherwise, and the container's console isn't reachable
    // from a browser. Single-operator app, and these messages carry no
    // credentials, so they go to the client verbatim.
    const message = error instanceof Error ? error.message : "Google Health sync failed. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
