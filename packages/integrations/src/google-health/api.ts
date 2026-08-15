// Google Health as a capacity-signal source — design doc §16, and 2026-08-14
// spec §7. Three data types only: sleep, daily resting heart rate, daily HRV.
//
// Field names for sleep and RHR (minutesAsleep, beatsPerMinute) are drawn
// from Google's docs and a third-party CLI's field notes — reasonably
// confident but not from an official worked example. HRV's value field is
// undocumented anywhere found (2026-08-14 spec §7 / design doc §15's own
// "absent from the public reference" risk) — checked against a few
// plausible names and fails loudly, naming the raw keys, rather than
// guessing wrong silently.

export type GoogleHealthKind = "sleep" | "rhr" | "hrv";

export interface GoogleHealthDataPoint {
  forDate: string; // "2026-08-13"
  value: number;
  unit: string;
}

const DATA_TYPE_PATH: Record<GoogleHealthKind, string> = {
  sleep: "sleep",
  rhr: "daily-resting-heart-rate",
  hrv: "daily-heart-rate-variability",
};

const JSON_FIELD: Record<GoogleHealthKind, string> = {
  sleep: "sleep",
  rhr: "dailyRestingHeartRate",
  hrv: "dailyHeartRateVariability",
};

const FILTER_FIELD: Record<GoogleHealthKind, string> = {
  sleep: "sleep",
  rhr: "daily_resting_heart_rate",
  hrv: "daily_heart_rate_variability",
};

// Filters are AIP-160, and the filterable time member differs by record type
// — there is no single expression that works for all three. Sleep is a
// Session type and filters on its interval's END time (start_time is not a
// valid member for it); RHR and HRV are Daily types and filter on a
// date-only `date`. Sending `<type>.interval.start_time` for everything is
// what the live API rejected with
// INVALID_DATA_POINT_FILTER_DATA_TYPE_MEMBER (2026-08-15).
function filterExpression(kind: GoogleHealthKind, sinceDate: string): string {
  if (kind === "sleep") {
    return `${FILTER_FIELD.sleep}.interval.end_time >= "${sinceDate}T00:00:00Z"`;
  }
  return `${FILTER_FIELD[kind]}.date >= "${sinceDate}"`;
}

function extractValue(kind: GoogleHealthKind, point: Record<string, unknown>): { value: number; unit: string } {
  if (kind === "sleep") {
    const minutes = point.minutesAsleep;
    if (typeof minutes !== "number") {
      throw new Error(`Google Health sleep data point missing minutesAsleep. Keys found: ${Object.keys(point).join(", ")}`);
    }
    return { value: Math.round((minutes / 60) * 10) / 10, unit: "hours" };
  }

  if (kind === "rhr") {
    const bpm = point.beatsPerMinute;
    if (typeof bpm !== "number") {
      throw new Error(`Google Health dailyRestingHeartRate data point missing beatsPerMinute. Keys found: ${Object.keys(point).join(", ")}`);
    }
    return { value: bpm, unit: "bpm" };
  }

  const ms = point.rmssdMillis ?? point.milliseconds ?? point.value;
  if (typeof ms !== "number") {
    throw new Error(
      `Google Health dailyHeartRateVariability data point has an unrecognized shape — expected ` +
        `rmssdMillis, milliseconds, or value. Keys found: ${Object.keys(point).join(", ")}`,
    );
  }
  return { value: ms, unit: "ms" };
}

export function parseGoogleHealthDataPoints(kind: GoogleHealthKind, json: unknown): GoogleHealthDataPoint[] {
  const dataPoints = (json as { dataPoints?: Array<Record<string, unknown>> }).dataPoints ?? [];
  const field = JSON_FIELD[kind];
  const results: GoogleHealthDataPoint[] = [];

  for (const raw of dataPoints) {
    const point = raw[field] as Record<string, unknown> | undefined;
    const interval = point?.interval as { startTime?: string } | undefined;
    if (!point || !interval?.startTime) continue;

    const { value, unit } = extractValue(kind, point);
    results.push({ forDate: interval.startTime.slice(0, 10), value, unit });
  }

  // Silence here is the dangerous case: every row dropped looks exactly like
  // "no health data recorded" and syncs 0 points as a success. If Google
  // sent rows and none survived, the shape isn't what this parser expects —
  // say so, and carry a whole raw row so the correction is mechanical rather
  // than another round of guessing at field names.
  if (dataPoints.length > 0 && results.length === 0) {
    throw new Error(
      `Google Health returned ${dataPoints.length} ${kind} data point(s) but none matched the expected ` +
        `shape (${field}.interval.startTime). First raw point: ${JSON.stringify(dataPoints[0])}`,
    );
  }

  return results;
}

export async function fetchGoogleHealthDataPoints(input: {
  kind: GoogleHealthKind;
  token: string;
  sinceDate: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleHealthDataPoint[]> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const url = new URL(
    `https://health.googleapis.com/v4/users/me/dataTypes/${DATA_TYPE_PATH[input.kind]}/dataPoints`,
  );
  url.searchParams.set("filter", filterExpression(input.kind, input.sinceDate));

  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${input.token}` } });
  const json = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Google Health API error (${input.kind}): ${json.error?.message ?? response.statusText}`);
  }
  return parseGoogleHealthDataPoints(input.kind, json);
}
