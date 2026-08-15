import { beforeEach, describe, expect, it, vi } from "vitest";

const createArtifact = vi.fn();
const upsertCapacitySignal = vi.fn();
const upsertConnectorCursor = vi.fn();

vi.mock("@headroom/graph", () => ({
  createArtifact: (input: unknown) => createArtifact(input),
  upsertCapacitySignal: (input: unknown) => upsertCapacitySignal(input),
  upsertConnectorCursor: (input: unknown) => upsertConnectorCursor(input),
}));

const fetchGoogleHealthDataPoints = vi.fn();
vi.mock("../api", () => ({
  fetchGoogleHealthDataPoints: (input: unknown) => fetchGoogleHealthDataPoints(input),
}));

beforeEach(() => {
  vi.clearAllMocks();
  upsertConnectorCursor.mockResolvedValue({});
  createArtifact.mockImplementation(async (input) => ({ id: `artifact-${input.excerpt}`, ...input }));
  upsertCapacitySignal.mockResolvedValue({});
  fetchGoogleHealthDataPoints.mockResolvedValue([]);
});

describe("syncGoogleHealth", () => {
  it("writes one capacity signal and one artifact per data point, across all three kinds", async () => {
    fetchGoogleHealthDataPoints.mockImplementation(async (input: { kind: string }) => {
      if (input.kind === "sleep") return [{ forDate: "2026-08-13", value: 7.2, unit: "hours" }];
      if (input.kind === "rhr") return [{ forDate: "2026-08-13", value: 58, unit: "bpm" }];
      if (input.kind === "hrv") return [{ forDate: "2026-08-13", value: 42, unit: "ms" }];
      return [];
    });

    const { syncGoogleHealth } = await import("../sync");
    const result = await syncGoogleHealth({
      userId: "u1",
      token: "ya29_test",
      now: new Date("2026-08-14T00:00:00Z"),
    });

    expect(result.pointsSynced).toBe(3);
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", source: "google_health", excerpt: "7.2h sleep" }),
    );
    expect(upsertCapacitySignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", kind: "sleep", value: 7.2, unit: "hours" }),
    );
    expect(upsertCapacitySignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", kind: "rhr", value: 58, unit: "bpm" }),
    );
    expect(upsertCapacitySignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", kind: "hrv", value: 42, unit: "ms" }),
    );
  });

  it("skips a day/kind with no data point rather than writing a zero", async () => {
    fetchGoogleHealthDataPoints.mockResolvedValue([]);

    const { syncGoogleHealth } = await import("../sync");
    const result = await syncGoogleHealth({ userId: "u1", token: "ya29_test", now: new Date("2026-08-14T00:00:00Z") });

    expect(result.pointsSynced).toBe(0);
    expect(createArtifact).not.toHaveBeenCalled();
    expect(upsertCapacitySignal).not.toHaveBeenCalled();
  });

  it("requests all three kinds with a trailing-week sinceDate", async () => {
    const { syncGoogleHealth } = await import("../sync");
    await syncGoogleHealth({ userId: "u1", token: "ya29_test", now: new Date("2026-08-14T00:00:00Z") });

    const kindsRequested = fetchGoogleHealthDataPoints.mock.calls.map((call) => call[0].kind).sort();
    expect(kindsRequested).toEqual(["hrv", "rhr", "sleep"]);
    for (const call of fetchGoogleHealthDataPoints.mock.calls) {
      expect(call[0].sinceDate).toBe("2026-08-07");
    }
  });
});
