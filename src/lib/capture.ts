// Capture — 2026-08-13 spec §6.
//
// The system prompt has told users their words were "already stored" since the
// voice harness shipped, and nothing stored them: `createArtifact` had no
// callers outside tests. That made the prompt itself the thing violating core
// rule 2 — a statement about the user's life with no `Artifact` behind it. This
// is the write that makes the sentence true.
//
// Deliberately not extraction. Nothing here reads the transcript, decides what
// a promise is, or writes a `Commitment`; that stays §6's job and its precision
// bar still gates Tier 1. This only records that the words were said.

import { createArtifact, type ArtifactRow } from "@headroom/graph";

type CreateArtifact = typeof createArtifact;

export async function captureUtterance(input: {
  userId: string;
  transcript: string;
  occurredAt: Date;
  // Injected so this is testable without Postgres, like every other engine
  // dependency in this codebase.
  createArtifactImpl?: CreateArtifact;
}): Promise<ArtifactRow | null> {
  const excerpt = input.transcript.trim();
  if (!excerpt) return null;

  const create = input.createArtifactImpl ?? createArtifact;

  try {
    return await create({
      userId: input.userId,
      source: "voice_note",
      occurredAt: input.occurredAt,
      excerpt,
    });
  } catch (error) {
    // The user is mid-conversation. Losing the artifact is bad; losing the
    // reply because of it is worse.
    console.error("[capture] could not store the utterance", error);
    return null;
  }
}
