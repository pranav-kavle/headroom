import { NextResponse } from "next/server";
import { GoogleCalendarSyncResponse } from "@headroom/contracts";
import { syncGoogleCalendar } from "@headroom/integrations";
import { getOrCreateUser } from "@/lib/auth";
import { getGoogleAccessToken } from "@/lib/google-token";

export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const token = await getGoogleAccessToken(user.clerkUserId);
  if (!token) {
    return NextResponse.json({ error: "Google is not connected yet." }, { status: 400 });
  }

  try {
    const summary = await syncGoogleCalendar({ userId: user.id, token, now: new Date() });
    return NextResponse.json(GoogleCalendarSyncResponse.parse(summary));
  } catch (error) {
    console.error("[integrations/google-calendar/sync]", error);
    return NextResponse.json({ error: "Google Calendar sync failed. Try again." }, { status: 502 });
  }
}
