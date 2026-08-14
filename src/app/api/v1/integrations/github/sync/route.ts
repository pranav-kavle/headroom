import { NextResponse } from "next/server";
import { GithubSyncResponse } from "@headroom/contracts";
import { syncGithub } from "@headroom/integrations";
import { getOrCreateUser } from "@/lib/auth";
import { getGithubAccessToken } from "@/lib/github-token";

export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const token = await getGithubAccessToken(user.clerkUserId);
  if (!token) {
    return NextResponse.json({ error: "GitHub is not connected yet." }, { status: 400 });
  }

  try {
    const summary = await syncGithub({ userId: user.id, token, now: new Date() });
    return NextResponse.json(GithubSyncResponse.parse(summary));
  } catch (error) {
    console.error("[integrations/github/sync]", error);
    return NextResponse.json({ error: "GitHub sync failed. Try again." }, { status: 502 });
  }
}
