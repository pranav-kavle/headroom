const SOURCE_LABELS: Record<string, string> = {
  gmail: "Email",
  calendar: "Calendar",
  github: "GitHub",
  voice_note: "Voice note",
  google_health: "Health",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function formatShortDate(date: Date): string {
  const daysAway = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysAway >= -1 && daysAway < 6) {
    return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

export function isWithinDays(date: Date, days: number): boolean {
  const daysAway = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysAway >= 0 && daysAway <= days;
}
