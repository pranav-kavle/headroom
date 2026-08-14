import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertConnectorCursor = vi.fn();
vi.mock("@headroom/graph", () => ({ upsertConnectorCursor: (input: unknown) => upsertConnectorCursor(input) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runIntegrationSync", () => {
  it("marks the cursor running, then idle with lastSyncedAt on success", async () => {
    const { runIntegrationSync } = await import("../sync-run");
    const now = new Date("2026-08-14T12:00:00.000Z");
    upsertConnectorCursor.mockResolvedValue({});

    const result = await runIntegrationSync({ userId: "u1", source: "github", now }, async () => ({ created: 2 }));

    expect(result).toEqual({ created: 2 });
    expect(upsertConnectorCursor).toHaveBeenNthCalledWith(1, { userId: "u1", source: "github", status: "running" });
    expect(upsertConnectorCursor).toHaveBeenNthCalledWith(2, {
      userId: "u1",
      source: "github",
      status: "idle",
      lastSyncedAt: now,
      errorMessage: null,
    });
  });

  it("marks the cursor error with the failure message and rethrows", async () => {
    const { runIntegrationSync } = await import("../sync-run");
    upsertConnectorCursor.mockResolvedValue({});

    await expect(
      runIntegrationSync({ userId: "u1", source: "github", now: new Date() }, async () => {
        throw new Error("GitHub GraphQL error: rate limited");
      }),
    ).rejects.toThrow("GitHub GraphQL error: rate limited");

    expect(upsertConnectorCursor).toHaveBeenNthCalledWith(2, {
      userId: "u1",
      source: "github",
      status: "error",
      errorMessage: "GitHub GraphQL error: rate limited",
    });
  });
});
