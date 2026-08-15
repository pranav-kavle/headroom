import { NextResponse } from "next/server";
import { SlackSyncResponse } from "@headroom/contracts";
import { syncSlack } from "@headroom/integrations";
import { getOrCreateUser } from "@/lib/auth";
import { getSlackCredentials } from "@/lib/slack-token";

export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const credentials = await getSlackCredentials(user.id);
  if (!credentials) {
    return NextResponse.json({ error: "Slack is not connected yet." }, { status: 400 });
  }

  try {
    const summary = await syncSlack({
      userId: user.id,
      token: credentials.accessToken,
      slackUserId: credentials.slackUserId,
      now: new Date(),
    });
    return NextResponse.json(SlackSyncResponse.parse(summary));
  } catch (error) {
    console.error("[integrations/slack/sync]", error);
    return NextResponse.json({ error: "Slack sync failed. Try again." }, { status: 502 });
  }
}
