import { describe, expect, it } from "vitest";
import { pingDatabase } from "@headroom/graph";

describe("engine graph access", () => {
  it("reaches the database through @headroom/graph", async () => {
    expect(await pingDatabase()).toBe(true);
  });
});
