import { describe, expect, it } from "vitest";
import { fetchGoogleCalendarEvents, parseGoogleCalendarEvents } from "../api";

const EVENTS_RESPONSE = {
  items: [
    {
      id: "evt_1",
      status: "confirmed",
      start: { dateTime: "2026-08-13T15:00:00Z" },
      end: { dateTime: "2026-08-13T16:00:00Z" },
    },
    {
      id: "evt_declined",
      status: "confirmed",
      start: { dateTime: "2026-08-13T17:00:00Z" },
      end: { dateTime: "2026-08-13T17:30:00Z" },
      attendees: [{ self: true, responseStatus: "declined" }],
    },
    {
      id: "evt_all_day",
      status: "confirmed",
      start: { date: "2026-08-13" },
      end: { date: "2026-08-14" },
    },
    {
      id: "evt_cancelled",
      status: "cancelled",
      start: { dateTime: "2026-08-13T18:00:00Z" },
      end: { dateTime: "2026-08-13T18:30:00Z" },
    },
  ],
};

describe("parseGoogleCalendarEvents", () => {
  it("keeps confirmed, timed, non-declined events", () => {
    const result = parseGoogleCalendarEvents(EVENTS_RESPONSE);

    expect(result).toEqual([
      { id: "evt_1", startsAt: new Date("2026-08-13T15:00:00Z"), endsAt: new Date("2026-08-13T16:00:00Z") },
    ]);
  });

  it("skips events the viewer declined", () => {
    const result = parseGoogleCalendarEvents(EVENTS_RESPONSE);
    expect(result.find((e) => e.id === "evt_declined")).toBeUndefined();
  });

  it("skips all-day events", () => {
    const result = parseGoogleCalendarEvents(EVENTS_RESPONSE);
    expect(result.find((e) => e.id === "evt_all_day")).toBeUndefined();
  });

  it("skips cancelled events", () => {
    const result = parseGoogleCalendarEvents(EVENTS_RESPONSE);
    expect(result.find((e) => e.id === "evt_cancelled")).toBeUndefined();
  });
});

describe("fetchGoogleCalendarEvents", () => {
  it("requests the primary calendar with a bearer token and the given window", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init! });
      return new Response(JSON.stringify(EVENTS_RESPONSE));
    };

    const result = await fetchGoogleCalendarEvents({
      token: "ya29_test",
      timeMin: new Date("2026-08-06T00:00:00Z"),
      timeMax: new Date("2026-08-14T00:00:00Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toHaveLength(1);
    expect(calls[0].url).toContain("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(calls[0].url).toContain("timeMin=2026-08-06T00%3A00%3A00.000Z");
    expect(calls[0].url).toContain("timeMax=2026-08-14T00%3A00%3A00.000Z");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer ya29_test");
  });

  it("throws a named error when Google returns an error response", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: "Invalid Credentials" } }), { status: 401 });

    await expect(
      fetchGoogleCalendarEvents({
        token: "bad",
        timeMin: new Date(),
        timeMax: new Date(),
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow(/Invalid Credentials/);
  });
});
