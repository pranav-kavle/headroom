// Recent turns — 2026-08-13 spec (turn identity / policy gate / verifier) §2.
//
// Replaces `agent-think-citations.ts`, which kept the latest citations in a
// Map keyed by user, overwrote it every turn, and let the browser *drain* it
// with a GET. Two rapid turns, two tabs, or a second container instance and the
// evidence landed on the wrong claim — which, for a product whose whole thesis
// is provenance, was the worst possible place to keep a race.
//
// Three changes: a turn has an id, reads are non-destructive, and the store is
// bounded by construction rather than growing one entry per user forever.

import type { Citation } from "./agent-loop";
import type { Violation } from "./verify-output";

export interface TurnRecord {
  turnId: string;
  userId: string;
  // Exactly what /api/v1/agent/think returned, which is exactly what Deepgram
  // sends back to the browser — so it is a key both sides already hold. §2.1.
  text: string;
  citations: Citation[];
  toolCalls: string[];
  blocked: Array<{ tool: string; tier: string; policy: string }>;
  violations: Violation[];
  totalMs: number;
  createdAt: string;
}

// A fixed ceiling across all users, not a per-user map. Long enough that the
// browser can always find the utterance it just heard, short enough that a busy
// process cannot accumulate transcripts indefinitely.
const MAX_TURNS = 200;

// In-process only, and the reason is §2: persisting a turn means an `AgentRun`
// row, which needs a `TriggerEvent`, whose `TriggerType` has no `voice`
// member. That is a migration and a modelling decision, not a line of code.
// Everything a row would need is now assembled here in one object.
const turns: TurnRecord[] = [];

export function recordTurn(record: TurnRecord): void {
  turns.push(record);
  if (turns.length > MAX_TURNS) turns.splice(0, turns.length - MAX_TURNS);
}

export function recentTurns(userId: string, limit = 10): TurnRecord[] {
  const mine: TurnRecord[] = [];
  for (let i = turns.length - 1; i >= 0 && mine.length < limit; i--) {
    if (turns[i].userId === userId) mine.push(turns[i]);
  }
  return mine;
}

// Tests only — the store is process-wide, so a test that records has to be
// able to leave it as it found it.
export function resetTurns(): void {
  turns.length = 0;
}
