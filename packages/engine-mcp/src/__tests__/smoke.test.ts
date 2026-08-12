import { describe, expect, it } from "vitest";
import { ping } from "../smoke";

describe("toolchain smoke test", () => {
  it("resolves the workspace, loads .env, and runs a test", () => {
    expect(ping()).toBe("pong");
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
