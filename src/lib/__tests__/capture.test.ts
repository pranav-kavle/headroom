import { describe, expect, it, vi } from "vitest";
import { captureUtterance } from "../capture";

// 2026-08-13 spec §6. The prompt has told users their words were "already
// stored" since the harness shipped, and nothing stored them — `createArtifact`
// had no callers outside tests. This is the write that makes the claim true.

const OCCURRED_AT = new Date("2026-08-13T14:00:00Z");

describe("captureUtterance", () => {
  it("stores the utterance as a voice_note artifact", async () => {
    const createArtifactImpl = vi.fn().mockResolvedValue({ id: "a1" });

    const artifact = await captureUtterance({
      userId: "u1",
      transcript: "I owe Maya the deck by Thursday",
      occurredAt: OCCURRED_AT,
      createArtifactImpl,
    });

    expect(createArtifactImpl).toHaveBeenCalledWith({
      userId: "u1",
      source: "voice_note",
      occurredAt: OCCURRED_AT,
      excerpt: "I owe Maya the deck by Thursday",
    });
    expect(artifact).toEqual({ id: "a1" });
  });

  // §6: no filtering. Deciding which utterances are commitments is extraction's
  // job, and it needs the negatives as much as the positives — filtering here
  // would make the prompt's capture claim conditionally true again, which is
  // the whole defect being removed.
  it("stores ordinary chat too, not just things that sound like promises", async () => {
    const createArtifactImpl = vi.fn().mockResolvedValue({ id: "a2" });

    await captureUtterance({
      userId: "u1",
      transcript: "what's the weather in Chicago",
      occurredAt: OCCURRED_AT,
      createArtifactImpl,
    });

    expect(createArtifactImpl).toHaveBeenCalledOnce();
  });

  // The user is mid-conversation. A Postgres hiccup should cost the artifact,
  // not the reply.
  it("returns null instead of throwing when the write fails", async () => {
    const createArtifactImpl = vi.fn().mockRejectedValue(new Error("connection reset"));

    const artifact = await captureUtterance({
      userId: "u1",
      transcript: "I owe Maya the deck",
      occurredAt: OCCURRED_AT,
      createArtifactImpl,
    });

    expect(artifact).toBeNull();
  });

  it("does not write anything for a blank transcript", async () => {
    const createArtifactImpl = vi.fn();

    const artifact = await captureUtterance({
      userId: "u1",
      transcript: "   ",
      occurredAt: OCCURRED_AT,
      createArtifactImpl,
    });

    expect(createArtifactImpl).not.toHaveBeenCalled();
    expect(artifact).toBeNull();
  });
});
