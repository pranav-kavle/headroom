import { beforeEach, describe, expect, it } from "vitest";
import { recentTurns, recordTurn, resetTurns, type TurnRecord } from "../agent-turns";

function turn(over: Partial<TurnRecord> = {}): TurnRecord {
  return {
    turnId: "t1",
    userId: "u1",
    text: "You have nothing on file.",
    citations: [],
    toolCalls: ["get_state"],
    blocked: [],
    violations: [],
    totalMs: 800,
    createdAt: "2026-08-13T14:00:00.000Z",
    ...over,
  };
}

beforeEach(() => resetTurns());

describe("recentTurns", () => {
  it("returns this user's turns, newest first", () => {
    recordTurn(turn({ turnId: "t1", text: "first" }));
    recordTurn(turn({ turnId: "t2", text: "second" }));

    expect(recentTurns("u1").map((t) => t.turnId)).toEqual(["t2", "t1"]);
  });

  it("never returns another user's turn", () => {
    recordTurn(turn({ turnId: "mine", userId: "u1" }));
    recordTurn(turn({ turnId: "theirs", userId: "u2" }));

    expect(recentTurns("u1").map((t) => t.turnId)).toEqual(["mine"]);
  });

  // The old store was destructive: the browser's GET consumed the citations,
  // so a second read — or a re-render — got nothing, and a turn's evidence
  // could be claimed by the wrong utterance.
  it("does not consume what it returns", () => {
    recordTurn(turn({ turnId: "t1" }));

    expect(recentTurns("u1")).toHaveLength(1);
    expect(recentTurns("u1")).toHaveLength(1);
  });

  it("stays bounded no matter how long the process runs", () => {
    for (let i = 0; i < 500; i++) recordTurn(turn({ turnId: `t${i}` }));

    expect(recentTurns("u1", 1000).length).toBeLessThanOrEqual(200);
    expect(recentTurns("u1")[0].turnId).toBe("t499");
  });
});
