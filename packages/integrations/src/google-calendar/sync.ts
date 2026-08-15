import { createArtifact, upsertCapacitySignal } from "@headroom/graph";
import { runIntegrationSync } from "../sync-run";
import { fetchGoogleCalendarEvents, type GoogleCalendarEvent } from "./api";

export interface GoogleCalendarSyncSummary {
  daysSynced: number;
}

// Trailing window, not a moving cursor — calendar edits land after the fact
// (an event moved or added yesterday), so each sync recomputes the whole
// window rather than trusting "new since last sync". 2026-08-14 spec §6.
const TRAILING_DAYS = 7;
// 9am-6pm assumption, not derived from anything — flagged in the spec as the
// first thing to revisit once real usage exists.
const WORKDAY_HOURS = 9;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDailyMeetingHours(
  events: GoogleCalendarEvent[],
  days: string[],
): Map<string, { meetingHours: number; eventCount: number }> {
  const byDay = new Map(days.map((day) => [day, { meetingHours: 0, eventCount: 0 }]));

  for (const event of events) {
    const bucket = byDay.get(dateKey(event.startsAt));
    if (!bucket) continue;
    bucket.meetingHours += hoursBetween(event.startsAt, event.endsAt);
    bucket.eventCount += 1;
  }

  return byDay;
}

export async function syncGoogleCalendar(input: {
  userId: string;
  token: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarSyncSummary> {
  return runIntegrationSync({ userId: input.userId, source: "calendar", now: input.now }, async () => {
    const timeMin = new Date(input.now);
    timeMin.setUTCDate(timeMin.getUTCDate() - TRAILING_DAYS);
    const timeMax = new Date(input.now);
    timeMax.setUTCDate(timeMax.getUTCDate() + 1);

    const events = await fetchGoogleCalendarEvents({
      token: input.token,
      timeMin,
      timeMax,
      fetchImpl: input.fetchImpl,
    });

    const days: string[] = [];
    for (let i = TRAILING_DAYS; i >= 0; i--) {
      const d = new Date(input.now);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(dateKey(d));
    }

    const byDay = computeDailyMeetingHours(events, days);

    let daysSynced = 0;
    for (const [day, { meetingHours, eventCount }] of byDay) {
      const forDate = new Date(`${day}T00:00:00.000Z`);
      const meetingHoursRounded = round2(meetingHours);
      const freeHours = Math.max(0, round2(WORKDAY_HOURS - meetingHoursRounded));

      // A fresh artifact every sync, not reused-by-day: the day's aggregate
      // can change between syncs (an event added or moved), so each sync's
      // number is its own immutable, timestamped claim rather than an edit
      // to a shared one. Artifact.externalId stays null — Postgres treats
      // NULLs as distinct, so this never collides with the unique index.
      const artifact = await createArtifact({
        userId: input.userId,
        source: "calendar",
        occurredAt: forDate,
        excerpt: `${eventCount} event${eventCount === 1 ? "" : "s"}, ${meetingHoursRounded}h booked`,
      });

      await upsertCapacitySignal({
        userId: input.userId,
        kind: "meeting_hours",
        value: meetingHoursRounded,
        unit: "hours",
        forDate,
        sourceArtifactId: artifact.id,
      });
      await upsertCapacitySignal({
        userId: input.userId,
        kind: "free_hours",
        value: freeHours,
        unit: "hours",
        forDate,
        sourceArtifactId: artifact.id,
      });
      daysSynced += 1;
    }

    return { daysSynced };
  });
}
