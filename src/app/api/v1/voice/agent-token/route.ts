import { NextResponse } from "next/server";
import { AgentTokenResponse } from "@headroom/contracts";
import { getOrCreateUser } from "@/lib/auth";
import { mintDeepgramAgentToken } from "@/lib/voice-agent-token";
import { signThinkToken } from "@/lib/agent-think-auth";

// Mints two short-lived credentials for one browser-initiated Voice Agent
// session — design doc 2026-08-12-deepgram-voice-agent-design.md §5. Deepgram
// calls /api/v1/agent/think directly with no browser cookie attached, so it
// needs its own signed proof of which user the session belongs to.
export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const deepgram = await mintDeepgramAgentToken();
    const thinkAuthToken = signThinkToken(user.id);

    return NextResponse.json(
      AgentTokenResponse.parse({
        deepgramAccessToken: deepgram.accessToken,
        deepgramExpiresInSeconds: deepgram.expiresInSeconds,
        thinkAuthToken,
      }),
    );
  } catch (error) {
    console.error("[agent-token] mint failed", error);
    return NextResponse.json({ error: "Could not start a voice session" }, { status: 502 });
  }
}
