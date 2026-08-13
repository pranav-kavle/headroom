// Design doc §16's events read: live listings from Ticketmaster Discovery.
// Discovery's public search only needs the API key as a query param — no
// OAuth, no backfill, no stored state.

export interface EventSummary {
  name: string;
  venue: string | null;
  city: string | null;
  startDate: string | null;
  startTime: string | null;
  url: string;
}

export function parseEvents(json: unknown): EventSummary[] {
  const events = (json as { _embedded?: { events?: unknown[] } })._embedded?.events;
  if (!Array.isArray(events)) return [];

  return events.map((raw) => {
    const event = raw as Record<string, unknown>;
    const venues = (event._embedded as { venues?: unknown[] } | undefined)?.venues;
    const venue = Array.isArray(venues) ? (venues[0] as Record<string, unknown>) : undefined;
    const city = venue?.city as { name?: string } | undefined;
    const start = (event.dates as { start?: Record<string, unknown> } | undefined)?.start ?? {};

    return {
      name: event.name as string,
      venue: (venue?.name as string) ?? null,
      city: city?.name ?? null,
      startDate: (start.localDate as string) ?? null,
      startTime: (start.localTime as string) ?? null,
      url: event.url as string,
    };
  });
}

export async function fetchEvents(input: {
  location: string;
  keyword?: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<EventSummary[]> {
  if (!input.apiKey) {
    throw new Error("Ticketmaster API key is not configured — cannot search events.");
  }
  const fetchImpl = input.fetchImpl ?? fetch;

  const params = new URLSearchParams({ apikey: input.apiKey, city: input.location, size: "5" });
  if (input.keyword) params.set("keyword", input.keyword);

  const response = await fetchImpl(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  return parseEvents(await response.json());
}
