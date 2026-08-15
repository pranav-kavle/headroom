// Google Calendar as a capacity-signal source — design doc §16, and
// 2026-08-14 spec (capacity_signal has no writer yet). No commitments,
// no counterparty resolution — just meeting load per day.

export interface GoogleCalendarEvent {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

interface RawEvent {
  id: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
}

export function parseGoogleCalendarEvents(json: unknown): GoogleCalendarEvent[] {
  const items = (json as { items?: RawEvent[] }).items ?? [];
  const events: GoogleCalendarEvent[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    // All-day events carry `date`, not `dateTime` — they don't book hours.
    if (!item.start?.dateTime || !item.end?.dateTime) continue;
    const self = item.attendees?.find((a) => a.self);
    if (self?.responseStatus === "declined") continue;

    events.push({ id: item.id, startsAt: new Date(item.start.dateTime), endsAt: new Date(item.end.dateTime) });
  }

  return events;
}

export async function fetchGoogleCalendarEvents(input: {
  token: string;
  timeMin: Date;
  timeMax: Date;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarEvent[]> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", input.timeMin.toISOString());
  url.searchParams.set("timeMax", input.timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${input.token}` } });
  const json = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${json.error?.message ?? response.statusText}`);
  }
  return parseGoogleCalendarEvents(json);
}
