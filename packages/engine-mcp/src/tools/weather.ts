// Design doc §16's cheapest read: live weather, current-conditions only. Needs
// no API key (Open-Meteo), no backfill, no stored state — a plan-quality
// signal, resolved fresh on every call.

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
}

export function parseGeocode(json: unknown): GeocodeResult | null {
  const results = (json as { results?: unknown[] })?.results;
  const first = Array.isArray(results) ? (results[0] as Record<string, unknown>) : undefined;
  if (!first || typeof first.latitude !== "number" || typeof first.longitude !== "number") {
    return null;
  }
  return { latitude: first.latitude, longitude: first.longitude, name: String(first.name) };
}

// WMO weather codes, per Open-Meteo's documented table — the values current
// (heh) as of this integration. Uncovered codes fall back rather than throw,
// since a plan-quality signal being slightly vague beats the tool failing.
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "dense drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "light rain showers",
  81: "rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with light hail",
  99: "thunderstorm with heavy hail",
};

export function weatherCodeDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "unknown conditions";
}

export interface WeatherReport {
  location: string;
  temperatureC: number;
  windKph: number;
  conditions: string;
  observedAt: string;
}

export function parseForecast(json: unknown, locationName: string): WeatherReport {
  const current = (json as { current?: Record<string, unknown> }).current ?? {};
  return {
    location: locationName,
    temperatureC: current.temperature_2m as number,
    windKph: current.wind_speed_10m as number,
    conditions: weatherCodeDescription(current.weather_code as number),
    observedAt: current.time as string,
  };
}

export async function fetchWeather(input: {
  location: string;
  fetchImpl?: typeof fetch;
}): Promise<WeatherReport> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const geoResponse = await fetchImpl(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.location)}&count=1`,
  );
  const geo = parseGeocode(await geoResponse.json());
  if (!geo) {
    throw new Error(`Could not find a place named "${input.location}"`);
  }

  const forecastResponse = await fetchImpl(
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,
  );
  return parseForecast(await forecastResponse.json(), geo.name);
}
