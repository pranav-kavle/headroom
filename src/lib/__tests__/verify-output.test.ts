import { describe, expect, it } from "vitest";
import { verifySpokenText } from "../verify-output";

// 2026-08-13 spec (turn identity / policy gate / verifier) §4. Core rule 1 was
// enforced entirely by asking the model nicely; this is the first thing in the
// codebase that actually checks.

const EVIDENCE = [
  JSON.stringify({
    today: "2026-08-13",
    openCommitments: [
      {
        id: "c1",
        summary: "Send Maya the deck",
        dueAt: "2026-08-14",
        quote: "I'll get Maya the deck by Thursday",
        sourceArtifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      },
    ],
    counts: { owedByMe: 1, owedToMe: 0 },
  }),
  "Today is Thursday 13 August 2026 (2026-08-13) in America/Chicago.",
];

describe("verifySpokenText", () => {
  it("passes a reply whose every figure traces to the evidence", () => {
    const violations = verifySpokenText({
      text: "You owe Maya the deck — 1 thing open, due Friday.",
      evidence: EVIDENCE,
      aboutUser: true,
    });

    expect(violations).toEqual([]);
  });

  // The false positive that silenced a demo. The user said "PR ninety one"
  // out loud, the model wrote "91", and a digits-to-digits comparison found
  // nothing — so every sentence mentioning the PR was replaced with the
  // can't-back-that-up fallback. Their own words are evidence regardless of
  // which notation each side happened to use.
  it("accepts a numeral the user spoke as words", () => {
    const violations = verifySpokenText({
      text: "PR 91 is merged.",
      evidence: ["Can you merge PR ninety one?"],
      aboutUser: true,
    });

    expect(violations).toEqual([]);
  });

  it("accepts a number word the evidence carries as digits", () => {
    const violations = verifySpokenText({
      text: "That's PR ninety-one, merged.",
      evidence: ['{"merged":true,"url":"https://github.com/acme/repo/pull/91"}'],
      aboutUser: true,
    });

    expect(violations).toEqual([]);
  });

  // The compound has to survive on both sides, or "ninety one" backs 90 and 1
  // and still not 91 — which is the same failure wearing a different hat.
  it("reads a spoken compound as one number", () => {
    const violations = verifySpokenText({
      text: "Ninety-one is done.",
      evidence: ["I merged ninety one this morning."],
      aboutUser: true,
    });

    expect(violations).toEqual([]);
  });

  // Widening the comparison must not turn the check off: a figure that traces
  // to nothing in either notation is still withheld.
  it("still catches a number that appears in neither notation", () => {
    const violations = verifySpokenText({
      text: "PR 77 is merged.",
      evidence: ["Can you merge PR ninety one?"],
      aboutUser: true,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("unsourced_number");
    expect(violations[0].severity).toBe("withheld");
  });

  // Core rule 1: the engine computes. A count the engine never produced is
  // exactly the failure the rule exists to prevent, and it is invisible in
  // logs without this.
  it("catches a number the engine never produced", () => {
    const violations = verifySpokenText({
      text: "You have 4 things open this week.",
      evidence: EVIDENCE,
      aboutUser: true,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("unsourced_number");
    expect(violations[0].severity).toBe("withheld");
    expect(violations[0].detail).toContain("4");
  });

  // §4: the rule is scoped to claims about the user's life, because core rule 2
  // is. A verifier that fired on all arithmetic would break the ordinary
  // conversation the prompt goes out of its way to allow.
  it("leaves ordinary conversation alone when no claim about the user was made", () => {
    const violations = verifySpokenText({
      text: "Two plus two is 4.",
      evidence: [],
      aboutUser: false,
    });

    expect(violations).toEqual([]);
  });

  it("accepts a figure the user said themselves", () => {
    const violations = verifySpokenText({
      text: "Got it — 3 slides by Thursday.",
      evidence: ["I owe Maya 3 slides by Thursday"],
      aboutUser: true,
    });

    expect(violations).toEqual([]);
  });

  // Always on, regardless of topic: these are machine-shaped tokens that
  // should never reach a speaker at all.
  it("catches an artifact id read out loud", () => {
    const violations = verifySpokenText({
      text: "That came from artifact 3f2504e0-4f89-41d3-9a0c-0305e82c3301.",
      evidence: EVIDENCE,
      aboutUser: true,
    });

    expect(violations.map((v) => v.kind)).toContain("spoke_identifier");
  });

  it("catches an ISO date read out loud, even though it is in the evidence", () => {
    const violations = verifySpokenText({
      text: "It's due 2026-08-14.",
      evidence: EVIDENCE,
      aboutUser: true,
    });

    expect(violations.map((v) => v.kind)).toContain("spoke_machine_date");
  });

  it("checks identifiers and dates even when the turn was not about the user", () => {
    const violations = verifySpokenText({
      text: "The show is on 2026-08-20.",
      evidence: [],
      aboutUser: false,
    });

    expect(violations.map((v) => v.kind)).toEqual(["spoke_machine_date"]);
  });

  it("reports every distinct problem, not just the first", () => {
    const violations = verifySpokenText({
      text: "You have 9 open, the oldest from 2026-08-01.",
      evidence: EVIDENCE,
      aboutUser: true,
    });

    expect(violations.map((v) => v.kind).sort()).toEqual([
      "spoke_machine_date",
      "unsourced_number",
    ]);
  });

  it("does not flag the same number twice", () => {
    const violations = verifySpokenText({
      text: "7 and 7 again.",
      evidence: [],
      aboutUser: true,
    });

    expect(violations).toHaveLength(1);
  });

  // The digit check's blind spot: the prompt tells the model to speak numbers
  // as words, so a fabricated figure is far more likely to arrive as "four"
  // than as "4".
  describe("numbers spelled as words", () => {
    it("catches a spelled count that matches no figure in the evidence", () => {
      const violations = verifySpokenText({
        text: "You have four things open.",
        evidence: EVIDENCE,
        aboutUser: true,
      });

      expect(violations.map((v) => v.kind)).toEqual(["unsourced_spoken_number"]);
    });

    it("accepts a spelled count that matches a figure by value", () => {
      const violations = verifySpokenText({
        text: "Just the one — Maya's deck.",
        evidence: EVIDENCE,
        aboutUser: true,
      });

      expect(violations).toEqual([]);
    });

    // "the fourteenth" is backed by a dueAt of 2026-08-14 — the comparison is
    // by value, not by spelling, or every date the agent said properly would
    // trip it.
    it("accepts an ordinal backed by a date in the evidence", () => {
      const violations = verifySpokenText({
        text: "It's due on the fourteenth.",
        evidence: EVIDENCE,
        aboutUser: true,
      });

      expect(violations).toEqual([]);
    });

    // This check is noisy by nature — "one moment" is a violation by the
    // letter and nothing by the spirit — so it records rather than silences.
    // Promoting it to `withheld` is a decision to make once its real rate is
    // known, not a guess to bake in now.
    it("flags rather than withholds, because it is the check most likely to be wrong", () => {
      const violations = verifySpokenText({
        text: "One moment.",
        evidence: ["nothing numeric here"],
        aboutUser: true,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("flagged");
    });

    it("stays out of ordinary conversation, like the digit check", () => {
      const violations = verifySpokenText({
        text: "There were three of them.",
        evidence: [],
        aboutUser: false,
      });

      expect(violations).toEqual([]);
    });
  });
});
