import type { Citation } from "./agent-loop";

// Design doc 2026-08-12-deepgram-voice-agent-design.md §6. Deepgram's WS
// carries spoken text back to the browser, not the citations that back it —
// those are produced inside /api/v1/agent/think and never reach Deepgram, so
// the browser fetches them separately after each agent turn. In-process only:
// a row just needs to survive the seconds between the think endpoint
// answering and the client asking, not outlive the process — one Docker
// instance per the main design doc §11, so a Map is enough for now.
const latestByUser = new Map<string, Citation[]>();

export function recordCitations(userId: string, citations: Citation[]): void {
  latestByUser.set(userId, citations);
}

export function takeCitations(userId: string): Citation[] {
  const citations = latestByUser.get(userId) ?? [];
  latestByUser.delete(userId);
  return citations;
}
