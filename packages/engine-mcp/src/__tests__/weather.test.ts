import { describe, expect, it } from "vitest";
import { fetchWeather, parseForecast, parseGeocode, weatherCodeDescription } from "../tools/weather";

const GEOCODE_RESPONSE = {
  results: [
    { id: 5128581, name: "New York", latitude: 40.71427, longitude: -74.00597, country: "United States" },
  ],
};

const FORECAST_RESPONSE = {
  timezone: "America/New_York",
  current_units: { temperature_2m: "°C", wind_speed_10m: "km/h" },
  current: { time: "2026-08-13T13:30", temperature_2m: 29.2, weather_code: 1, wind_speed_10m: 13.9 },
};

describe("parseGeocode", () => {
  it("reads the first result's coordinates and resolved name", () => {
    expect(parseGeocode(GEOCODE_RESPONSE)).toEqual({
      latitude: 40.71427,
      longitude: -74.00597,
      name: "New York",
    });
  });

  it("returns null when the place can't be found", () => {
    expect(parseGeocode({ results: [] })).toBeNull();
    expect(parseGeocode({})).toBeNull();
  });
});

describe("weatherCodeDescription", () => {
  it("maps known WMO codes to plain descriptions", () => {
    expect(weatherCodeDescription(0)).toBe("clear sky");
    expect(weatherCodeDescription(95)).toBe("thunderstorm");
  });

  it("falls back to a generic label for an unknown code", () => {
    expect(weatherCodeDescription(999)).toBe("unknown conditions");
  });
});

describe("parseForecast", () => {
  it("builds a plain-language weather report from Open-Meteo's current block", () => {
    expect(parseForecast(FORECAST_RESPONSE, "New York")).toEqual({
      location: "New York",
      temperatureC: 29.2,
      windKph: 13.9,
      conditions: "mainly clear",
      observedAt: "2026-08-13T13:30",
    });
  });
});

describe("fetchWeather", () => {
  it("geocodes the location, then fetches its current forecast", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL) => {
      calls.push(url.toString());
      const body = url.toString().includes("geocoding-api") ? GEOCODE_RESPONSE : FORECAST_RESPONSE;
      return new Response(JSON.stringify(body));
    };

    const result = await fetchWeather({ location: "New York", fetchImpl: fetchImpl as typeof fetch });

    expect(result).toEqual({
      location: "New York",
      temperatureC: 29.2,
      windKph: 13.9,
      conditions: "mainly clear",
      observedAt: "2026-08-13T13:30",
    });
    expect(calls[0]).toContain("geocoding-api.open-meteo.com");
    expect(calls[1]).toContain("api.open-meteo.com/v1/forecast");
    expect(calls[1]).toContain("latitude=40.71427");
  });

  it("throws a named error when the place can't be geocoded, rather than guessing coordinates", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ results: [] }));

    await expect(
      fetchWeather({ location: "Nowheresville", fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(/Nowheresville/);
  });
});
