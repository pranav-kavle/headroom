import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeDailyMeetingHours } from "../sync";

const createArtifact = vi.fn();
const upsertCapacitySignal = vi.fn();
const upsertConnectorCursor = vi.fn();

vi.mock("@headroom/graph", () => ({
  createArtifact: (input: unknown) => createArtifact(input),
  upsertCapacitySignal: (input: unknown) => upsertCapacitySignal(input),
  upsertConnectorCursor: (input: unknown) => upsertConnectorCursor(input),
}));

const fetchGoogleCalendarEvents = vi.fn();
vi.mock("../api", () => ({
  fetchGoogleCalendarEvents: (input: unknown) => fetchGoogleCalendarEvents(input),
}));

describe("computeDailyMeetingHours", () => {
  it("sums event durations per day and counts events", () => {
    const result = computeDailyMeetingHours(
      [
        { id: "e1", startsAt: new Date("2026-08-13T15:00:00Z"), endsAt: new Date("2026-08-13T16:00:00Z") },
        { id: "e2", startsAt: new Date("2026-08-13T16:00:00Z"), endsAt: new Date("2026-08-13T16:30:00Z") },
        { id: "e3", startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T10:00:00Z") },
      ],
      ["2026-08-13", "2026-08-14"],
    );

    expect(result.get("2026-08-13")).toEqual({ meetingHours: 1.5, eventCount: 2 });
    expect(result.get("2026-08-14")).toEqual({ meetingHours: 1, eventCount: 1 });
  });

  it("gives every requested day a zero-value bucket even with no events", () => {
    const result = computeDailyMeetingHours([], ["2026-08-13"]);
    expect(result.get("2026-08-13")).toEqual({ meetingHours: 0, eventCount: 0 });
  });

  it("ignores events outside the requested days", () => {
    const result = computeDailyMeetingHours(
      [{ id: "e1", startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-01-01T01:00:00Z") }],
      ["2026-08-13"],
    );
    expect(result.get("2026-08-13")).toEqual({ meetingHours: 0, eventCount: 0 });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  upsertConnectorCursor.mockResolvedValue({});
  createArtifact.mockImplementation(async (input) => ({ id: `artifact-${input.excerpt}`, ...input }));
  upsertCapacitySignal.mockResolvedValue({});
});

describe("syncGoogleCalendar", () => {
  it("writes meeting_hours and free_hours citing one artifact per day", async () => {
    fetchGoogleCalendarEvents.mockResolvedValue([
      { id: "e1", startsAt: new Date("2026-08-14T15:00:00Z"), endsAt: new Date("2026-08-14T19:00:00Z") },
    ]);

    const { syncGoogleCalendar } = await import("../sync");
    const result = await syncGoogleCalendar({
      userId: "u1",
      token: "ya29_test",
      now: new Date("2026-08-14T00:00:00Z"),
    });

    expect(result.daysSynced).toBe(8); // trailing 7 days + today

    const aug14Artifact = createArtifact.mock.calls.find(
      (call) => call[0].excerpt === "1 event, 4h booked",
    );
    expect(aug14Artifact?.[0]).toEqual(
      expect.objectContaining({ userId: "u1", source: "calendar", excerpt: "1 event, 4h booked" }),
    );

    const meetingHoursCall = upsertCapacitySignal.mock.calls.find(
      (call) => call[0].kind === "meeting_hours" && call[0].forDate.toISOString().startsWith("2026-08-14"),
    );
    expect(meetingHoursCall?.[0]).toEqual(
      expect.objectContaining({ userId: "u1", kind: "meeting_hours", value: 4, unit: "hours" }),
    );

    const freeHoursCall = upsertCapacitySignal.mock.calls.find(
      (call) => call[0].kind === "free_hours" && call[0].forDate.toISOString().startsWith("2026-08-14"),
    );
    expect(freeHoursCall?.[0]).toEqual(
      expect.objectContaining({ userId: "u1", kind: "free_hours", value: 5, unit: "hours" }),
    );
  });

  it("clamps free_hours at zero on an overbooked day", async () => {
    fetchGoogleCalendarEvents.mockResolvedValue([
      { id: "e1", startsAt: new Date("2026-08-14T00:00:00Z"), endsAt: new Date("2026-08-14T12:00:00Z") },
    ]);

    const { syncGoogleCalendar } = await import("../sync");
    await syncGoogleCalendar({ userId: "u1", token: "ya29_test", now: new Date("2026-08-14T00:00:00Z") });

    const freeHoursCall = upsertCapacitySignal.mock.calls.find(
      (call) => call[0].kind === "free_hours" && call[0].forDate.toISOString().startsWith("2026-08-14"),
    );
    expect(freeHoursCall?.[0].value).toBe(0);
  });
});
