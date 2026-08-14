import { describe, expect, it } from "vitest";
import { describeTimeZone } from "../timezone";

// Mid-August, so the northern-hemisphere zones below are on summer time.
const AUGUST = new Date("2026-08-13T12:00:00.000Z");

describe("describeTimeZone", () => {
  it("reads the city off an IANA zone and un-snakes it", () => {
    expect(describeTimeZone("America/New_York", AUGUST).city).toBe("New York");
  });

  it("renders the offset with a real minus sign, not a hyphen", () => {
    const { offset } = describeTimeZone("America/New_York", AUGUST);

    expect(offset).toBe("UTC−4");
    expect(offset).not.toContain("-");
  });

  it("handles positive offsets", () => {
    expect(describeTimeZone("Europe/London", AUGUST).offset).toBe("UTC+1");
  });

  it("spells zero offset as UTC+0 rather than a bare UTC", () => {
    expect(describeTimeZone("UTC", AUGUST)).toEqual({ city: "UTC", offset: "UTC+0" });
  });

  // The zone comes from the browser, so a value Intl rejects should degrade to
  // just the name rather than throwing the whole onboarding card away.
  it("falls back to an empty offset for a zone Intl does not know", () => {
    expect(describeTimeZone("Not/AZone", AUGUST)).toEqual({ city: "AZone", offset: "" });
  });
});
