import { describe, expect, it } from "vitest";
import { formatDateLabel, timeOfDayGreeting } from "../greeting";

const MIDDAY_UTC = new Date("2026-08-13T13:00:00.000Z");
const LATE_UTC = new Date("2026-08-13T23:00:00.000Z");

describe("timeOfDayGreeting", () => {
  it("greets in the user's zone, not the server's", () => {
    // One instant, two zones, two different times of day.
    expect(timeOfDayGreeting(MIDDAY_UTC, "America/New_York")).toBe("Morning");
    expect(timeOfDayGreeting(MIDDAY_UTC, "Europe/London")).toBe("Afternoon");
  });

  it("rolls over to evening after 18:00 local", () => {
    expect(timeOfDayGreeting(LATE_UTC, "America/New_York")).toBe("Evening");
  });

  it("falls back to UTC when we have no zone yet", () => {
    expect(timeOfDayGreeting(MIDDAY_UTC, null)).toBe("Afternoon");
    expect(timeOfDayGreeting(MIDDAY_UTC, "  ")).toBe("Afternoon");
  });

  it("falls back rather than throwing on a zone Intl rejects", () => {
    expect(timeOfDayGreeting(MIDDAY_UTC, "Not/AZone")).toBe("Afternoon");
  });
});

describe("formatDateLabel", () => {
  it("renders the local day", () => {
    expect(formatDateLabel(MIDDAY_UTC, "America/New_York")).toBe("Thursday 13 August");
  });

  // 23:00 UTC is already the 14th in Sydney — the label has to follow the user.
  it("uses the user's calendar day, not UTC's", () => {
    expect(formatDateLabel(LATE_UTC, "Australia/Sydney")).toBe("Friday 14 August");
  });

  it("falls back rather than throwing on a zone Intl rejects", () => {
    expect(formatDateLabel(MIDDAY_UTC, "Not/AZone")).toBe("Thursday 13 August");
  });
});
