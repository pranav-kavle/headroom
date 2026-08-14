import { NextResponse } from "next/server";
import { AgentTurnsResponse } from "@headroom/contracts";
import { getOrCreateUser } from "@/lib/auth";
import { recentTurns } from "@/lib/agent-turns";

// The evidence side channel — 2026-08-13 spec §2.1. Citations are produced
// inside /api/v1/agent/think and never travel over Deepgram's socket, so the
// browser fetches them here after each agent utterance and matches them to
// that utterance by its text.
//
// Non-destructive, unlike the /citations endpoint this replaces: reading is
// idempotent, so a re-render or a second tab cannot steal another turn's
// evidence. Only the caller's own turns are ever returned.
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json(
    AgentTurnsResponse.parse({
      turns: recentTurns(user.id).map((turn) => ({
        turnId: turn.turnId,
        text: turn.text,
        citations: turn.citations,
      })),
    }),
  );
}
