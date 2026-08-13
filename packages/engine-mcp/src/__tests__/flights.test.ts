import { describe, expect, it } from "vitest";
import { fetchFlightStatus, parseFlightStatus } from "../tools/flights";

const AERODATABOX_RESPONSE = [
  {
    number: "BA 249",
    status: "Expected",
    airline: { name: "British Airways", iata: "BA" },
    departure: {
      airport: { iata: "LHR", name: "London Heathrow", municipalityName: "London" },
      scheduledTime: { utc: "2026-08-13 20:45Z", local: "2026-08-13 21:45+01:00" },
      revisedTime: { utc: "2026-08-13 20:45Z", local: "2026-08-13 21:45+01:00" },
    },
    arrival: {
      airport: { iata: "GIG", name: "Rio de Janeiro RIOgaleão – Tom Jobim", municipalityName: "Rio de Janeiro" },
      scheduledTime: { utc: "2026-08-14 08:25Z", local: "2026-08-14 05:25-03:00" },
      predictedTime: { utc: "2026-08-14 07:50Z", local: "2026-08-14 04:50-03:00" },
    },
  },
];

describe("parseFlightStatus", () => {
  it("extracts status, airline, and departure/arrival detail from the first matching leg", () => {
    expect(parseFlightStatus(AERODATABOX_RESPONSE, "BA249")).toEqual({
      flightNumber: "BA 249",
      airline: "British Airways",
      status: "Expected",
      departure: {
        airport: "London Heathrow",
        scheduledLocal: "2026-08-13 21:45+01:00",
        revisedLocal: "2026-08-13 21:45+01:00",
      },
      arrival: {
        airport: "Rio de Janeiro RIOgaleão – Tom Jobim",
        scheduledLocal: "2026-08-14 05:25-03:00",
        revisedLocal: "2026-08-14 04:50-03:00",
      },
    });
  });

  it("throws a named error when the flight number has no legs on that date, rather than guessing", () => {
    expect(() => parseFlightStatus([], "BA249")).toThrow(/BA249/);
  });

  it("falls back to the scheduled time when no revised/predicted time is present", () => {
    const [leg] = AERODATABOX_RESPONSE;
    const noRevision = [
      {
        ...leg,
        departure: { ...leg.departure, revisedTime: undefined },
        arrival: { ...leg.arrival, predictedTime: undefined },
      },
    ];
    const result = parseFlightStatus(noRevision, "BA249");
    expect(result.departure.revisedLocal).toBe("2026-08-13 21:45+01:00");
    expect(result.arrival.revisedLocal).toBe("2026-08-14 05:25-03:00");
  });
});

describe("fetchFlightStatus", () => {
  it("calls AeroDataBox with the RapidAPI headers and returns the parsed status", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify(AERODATABOX_RESPONSE));
    };

    const result = await fetchFlightStatus({
      flightNumber: "BA249",
      date: "2026-08-14",
      apiKey: "test-rapidapi-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.flightNumber).toBe("BA 249");
    expect(capturedUrl).toBe("https://aerodatabox.p.rapidapi.com/flights/number/BA249/2026-08-14");
    expect(capturedHeaders["x-rapidapi-key"]).toBe("test-rapidapi-key");
    expect(capturedHeaders["x-rapidapi-host"]).toBe("aerodatabox.p.rapidapi.com");
  });

  it("throws a named error when no API key is configured", async () => {
    await expect(
      fetchFlightStatus({
        flightNumber: "BA249",
        date: "2026-08-14",
        apiKey: "",
        fetchImpl: (async () => new Response("[]")) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/rapidapi/i);
  });
});
