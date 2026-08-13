import { describe, expect, it } from "vitest";
import { fetchEvents, parseEvents } from "../tools/events";

const TICKETMASTER_RESPONSE = {
  _embedded: {
    events: [
      {
        name: "New York Rangers vs. Boston Bruins",
        url: "https://www.ticketmaster.com/event/3B0064F1B1E4447C",
        dates: { start: { localDate: "2027-01-16", localTime: "12:00:00" } },
        _embedded: {
          venues: [{ name: "Madison Square Garden", city: { name: "New York" } }],
        },
      },
    ],
  },
};

describe("parseEvents", () => {
  it("extracts name, venue, city, date, and link from Ticketmaster's event shape", () => {
    expect(parseEvents(TICKETMASTER_RESPONSE)).toEqual([
      {
        name: "New York Rangers vs. Boston Bruins",
        venue: "Madison Square Garden",
        city: "New York",
        startDate: "2027-01-16",
        startTime: "12:00:00",
        url: "https://www.ticketmaster.com/event/3B0064F1B1E4447C",
      },
    ]);
  });

  it("returns an empty list when Ticketmaster has nothing for the search", () => {
    expect(parseEvents({})).toEqual([]);
  });

  it("tolerates an event with no embedded venue rather than throwing", () => {
    const noVenue = { _embedded: { events: [{ name: "TBD show", url: "https://x", dates: { start: {} } }] } };
    expect(parseEvents(noVenue)).toEqual([
      { name: "TBD show", venue: null, city: null, startDate: null, startTime: null, url: "https://x" },
    ]);
  });
});

describe("fetchEvents", () => {
  it("sends the API key, location, and optional keyword as query params", async () => {
    let requestedUrl = "";
    const fetchImpl = async (url: string | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify(TICKETMASTER_RESPONSE));
    };

    const result = await fetchEvents({
      location: "New York",
      keyword: "hockey",
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toHaveLength(1);
    const params = new URL(requestedUrl).searchParams;
    expect(params.get("apikey")).toBe("test-key");
    expect(params.get("city")).toBe("New York");
    expect(params.get("keyword")).toBe("hockey");
  });

  it("throws a named error when no API key is configured, rather than calling Ticketmaster unauthenticated", async () => {
    await expect(
      fetchEvents({ location: "New York", apiKey: "", fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch }),
    ).rejects.toThrow(/ticketmaster/i);
  });
});
