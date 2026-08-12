import { NextResponse } from "next/server";
import { AgentTurnCitationsResponse } from "@headroom/contracts";
import { getOrCreateUser } from "@/lib/auth";
import { takeCitations } from "@/lib/agent-think-citations";

// Design doc 2026-08-12-deepgram-voice-agent-design.md §6. Citations for a
// turn are produced inside /api/v1/agent/think and never travel over
// Deepgram's socket, so the browser polls this side channel after each agent
// utterance rather than reading them off the WS.
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json(AgentTurnCitationsResponse.parse({ citations: takeCitations(user.id) }));
}
