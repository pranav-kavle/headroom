import { describe, expect, it } from "vitest";
import { isNeedsYou, isOnTrack, isWaitingOnOthers } from "@/lib/commitment-groups";

describe("isNeedsYou", () => {
  it("is true for a commitment owed by me that is at risk", () => {
    expect(isNeedsYou({ direction: "owed_by_me", status: "at_risk" })).toBe(true);
  });

  it("is true for a commitment owed by me that is overdue", () => {
    expect(isNeedsYou({ direction: "owed_by_me", status: "overdue" })).toBe(true);
  });

  it("is false for a commitment owed by me that is still open", () => {
    expect(isNeedsYou({ direction: "owed_by_me", status: "open" })).toBe(false);
  });

  it("is false for an at-risk commitment owed to me", () => {
    expect(isNeedsYou({ direction: "owed_to_me", status: "at_risk" })).toBe(false);
  });
});

describe("isOnTrack", () => {
  it("is true for an open commitment owed by me", () => {
    expect(isOnTrack({ direction: "owed_by_me", status: "open" })).toBe(true);
  });

  it("is false for an at-risk commitment owed by me", () => {
    expect(isOnTrack({ direction: "owed_by_me", status: "at_risk" })).toBe(false);
  });

  it("is false for an open commitment owed to me", () => {
    expect(isOnTrack({ direction: "owed_to_me", status: "open" })).toBe(false);
  });
});

describe("isWaitingOnOthers", () => {
  it("is true for an open commitment owed to me", () => {
    expect(isWaitingOnOthers({ direction: "owed_to_me", status: "open" })).toBe(true);
  });

  it("is true for an overdue commitment owed to me", () => {
    expect(isWaitingOnOthers({ direction: "owed_to_me", status: "overdue" })).toBe(true);
  });

  it("is false for a fulfilled commitment owed to me", () => {
    expect(isWaitingOnOthers({ direction: "owed_to_me", status: "fulfilled" })).toBe(false);
  });

  it("is false for an open commitment owed by me", () => {
    expect(isWaitingOnOthers({ direction: "owed_by_me", status: "open" })).toBe(false);
  });
});
