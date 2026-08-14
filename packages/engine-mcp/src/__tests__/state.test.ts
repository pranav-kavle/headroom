import { describe, expect, it } from "vitest";
import { buildState, type StateCommitmentInput } from "../tools/state";

// Design doc §7's `get_state`, minus capacity signals and load (no
// `CapacitySignal` rows exist — no connector produces them).
//
// Core rule 1 is what shapes this: the engine computes, the model phrases. So
// `now` is injected rather than read here, every date and count comes out of
// this function, and per core rule 2 every commitment carries the quote and
// artifact it traces to.

const NOW = new Date("2026-08-12T09:30:00Z");

function commitment(over: Partial<StateCommitmentInput> = {}): StateCommitmentInput {
  return {
    id: "c1",
    direction: "owed_by_me",
    summary: "Send Maya the deck",
    status: "open",
    dueAt: new Date("2026-08-13T00:00:00Z"),
    duePrecision: "day",
    quote: "I told Maya I'd get her the deck by Thursday",
    sourceArtifactId: "a1",
    counterpartyPerson: { displayName: "Maya Rodriguez" },
    ...over,
  };
}

describe("buildState", () => {
  it("resolves today from the injected clock, so the model never computes a date", () => {
    expect(buildState({ now: NOW, commitments: [] }).today).toBe("2026-08-12");
  });

  it("keeps only open, at-risk, and overdue commitments", () => {
    const state = buildState({
      now: NOW,
      commitments: [
        commitment({ id: "open", status: "open" }),
        commitment({ id: "at-risk", status: "at_risk" }),
        commitment({ id: "overdue", status: "overdue" }),
        commitment({ id: "done", status: "fulfilled" }),
        commitment({ id: "gone", status: "cancelled" }),
      ],
    });

    expect(state.openCommitments.map((c) => c.id)).toEqual(["open", "at-risk", "overdue"]);
  });

  it("carries the quote and source artifact for every commitment", () => {
    const [item] = buildState({ now: NOW, commitments: [commitment()] }).openCommitments;

    expect(item.quote).toBe("I told Maya I'd get her the deck by Thursday");
    expect(item.sourceArtifactId).toBe("a1");
  });

  it("counts by direction so the model never has to", () => {
    const state = buildState({
      now: NOW,
      commitments: [
        commitment({ id: "a", direction: "owed_by_me" }),
        commitment({ id: "b", direction: "owed_by_me" }),
        commitment({ id: "c", direction: "owed_to_me" }),
        commitment({ id: "d", direction: "owed_by_me", status: "fulfilled" }),
      ],
    });

    expect(state.counts).toEqual({ owedByMe: 2, owedToMe: 1 });
  });

  // 2026-08-13 spec §4.2. The principal block resolves "today" in the user's
  // own zone; if `get_state` answered in UTC the two engine-authored dates
  // would disagree for every user west of Greenwich after 18:00 local.
  describe("timezone", () => {
    it("resolves today in the user's zone, not UTC", () => {
      const lateEvening = new Date("2026-08-14T02:00:00Z"); // 21:00 Aug 13 in Chicago

      expect(buildState({ now: lateEvening, timezone: "America/Chicago" }).today).toBe("2026-08-13");
      expect(buildState({ now: lateEvening }).today).toBe("2026-08-14");
    });

    it("formats due dates in the same zone", () => {
      const state = buildState({
        now: NOW,
        timezone: "America/Chicago",
        commitments: [commitment({ dueAt: new Date("2026-08-14T02:00:00Z") })],
      });

      expect(state.openCommitments[0].dueAt).toBe("2026-08-13");
    });

    it("falls back to UTC on an unusable zone rather than throwing mid-turn", () => {
      expect(buildState({ now: NOW, timezone: "Mars/Olympus_Mons" }).today).toBe("2026-08-12");
    });
  });

  it("formats due dates as plain ISO days, and leaves undated commitments null", () => {
    const state = buildState({
      now: NOW,
      commitments: [
        commitment({ id: "dated", dueAt: new Date("2026-08-13T00:00:00Z") }),
        commitment({ id: "vague", dueAt: null, duePrecision: "vague" }),
      ],
    });

    expect(state.openCommitments[0].dueAt).toBe("2026-08-13");
    expect(state.openCommitments[1].dueAt).toBeNull();
  });
});
