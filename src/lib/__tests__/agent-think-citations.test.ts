import { describe, expect, it } from "vitest";
import { recordCitations, takeCitations } from "../agent-think-citations";

describe("agent-think-citations", () => {
  it("returns citations recorded for that user", () => {
    recordCitations("user-1", [{ artifactId: "a1", quote: "I owe Maya the deck" }]);

    expect(takeCitations("user-1")).toEqual([{ artifactId: "a1", quote: "I owe Maya the deck" }]);
  });

  it("returns an empty array when nothing was recorded for that user", () => {
    expect(takeCitations("user-with-nothing-recorded")).toEqual([]);
  });

  it("clears citations once taken, so a stale turn doesn't resurface", () => {
    recordCitations("user-2", [{ artifactId: "a2", quote: "send the invoice" }]);

    takeCitations("user-2");

    expect(takeCitations("user-2")).toEqual([]);
  });

  it("keeps each user's citations independent", () => {
    recordCitations("user-3", [{ artifactId: "a3", quote: "call Maya" }]);
    recordCitations("user-4", [{ artifactId: "a4", quote: "send Maya the deck" }]);

    expect(takeCitations("user-3")).toEqual([{ artifactId: "a3", quote: "call Maya" }]);
    expect(takeCitations("user-4")).toEqual([{ artifactId: "a4", quote: "send Maya the deck" }]);
  });
});
