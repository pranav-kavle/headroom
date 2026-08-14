// The Brief greets you in *your* morning, not the server's. The zone comes
// from the /welcome flow; when we don't have one, UTC is the honest fallback —
// wrong by hours for some users, but never silently the datacentre's local time.
const FALLBACK_ZONE = "UTC";

function zoneOrFallback(timeZone: string | null): string {
  return timeZone?.trim() || FALLBACK_ZONE;
}

function hourIn(now: Date, timeZone: string): number {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(now);
    return Number(hour);
  } catch {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: FALLBACK_ZONE,
      }).format(now),
    );
  }
}

export function timeOfDayGreeting(now: Date, timeZone: string | null): string {
  const hour = hourIn(now, zoneOrFallback(timeZone));
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function formatDateLabel(now: Date, timeZone: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: zoneOrFallback(timeZone) }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: FALLBACK_ZONE }).format(now);
  }
}
