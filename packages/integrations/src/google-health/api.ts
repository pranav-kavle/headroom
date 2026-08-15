// Google Health as a capacity-signal source — design doc §16, and 2026-08-14
// spec §7. Three data types only: sleep, daily resting heart rate, daily HRV.
//
// All three readings are now taken from the v4 REST/RPC reference rather
// than guessed (2026-08-15). The original field names were invented, and
// every one of them was wrong in the same two ways: the value sits one level
// down from where we looked, and int64 fields arrive as JSON *strings*, not
// numbers. Only sleep has been seen live so far — it syncs first, so its
// failure kept RHR and HRV from ever being exercised.
//
// The shape splits by record type, and that split is the thing to hold onto:
// sleep is a Session (an `interval`), RHR and HRV are Daily (a civil `date`
// of integers, no interval at all). Nothing here shares a date path.

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

// Proto3 serializes int64 as a JSON *string* so the value survives JS's
// 2^53 precision limit; the encoding permits a bare number too. Every int64
// in this API arrives that way — sleep's minute counts and RHR's
// beatsPerMinute alike — so both forms have to read.
function asInt64(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) return Number(raw);
  return null;
}

function extractValue(kind: GoogleHealthKind, point: Record<string, unknown>): { value: number; unit: string } {
  if (kind === "sleep") {
    // minutesAsleep is a member of `summary`, not of the sleep record itself
    // — and it arrives as an int64 string. Reading `sleep.minutesAsleep` as a
    // number missed on both counts against the live API (2026-08-15).
    //
    // `stages` carries enough to add a total up by hand. Doing that would be
    // the model inventing a figure Google already computed, which §3.1 puts
    // out of bounds — only the summary's own number is quotable.
    const summary = point.summary as Record<string, unknown> | undefined;
    const minutes = asInt64(summary?.minutesAsleep);
    if (minutes === null) {
      throw new Error(
        `Google Health sleep data point missing summary.minutesAsleep. ` +
          `Keys found: ${Object.keys(point).join(", ")}` +
          (summary ? `; summary keys: ${Object.keys(summary).join(", ")}` : ""),
      );
    }
    return { value: Math.round((minutes / 60) * 10) / 10, unit: "hours" };
  }

  if (kind === "rhr") {
    // int64 again, so a JSON string.
    const bpm = asInt64(point.beatsPerMinute);
    if (bpm === null) {
      throw new Error(`Google Health dailyRestingHeartRate data point missing beatsPerMinute. Keys found: ${Object.keys(point).join(", ")}`);
    }
    return { value: bpm, unit: "bpm" };
  }

  // The daily average, a double — not deepSleepRootMeanSquareOfSuccessive-
  // DifferencesMilliseconds, which sits alongside it and measures something
  // else. Falling back to it on days the average is absent would make the
  // baseline comparison in design doc §11 read a field switch as a change in
  // the user's physiology, so an absent average is an error, not a gap to
  // paper over.
  const ms = point.averageHeartRateVariabilityMilliseconds;
  if (typeof ms !== "number") {
    throw new Error(
      `Google Health dailyHeartRateVariability data point missing ` +
        `averageHeartRateVariabilityMilliseconds. Keys found: ${Object.keys(point).join(", ")}`,
    );
  }
  return { value: ms, unit: "ms" };
}

// Session types (sleep) carry an `interval`; Daily types (RHR, HRV) have no
// interval at all — they carry a civil google.type.Date of plain integers.
// Requiring interval.startTime for every kind is what dropped every daily
// row, which surfaced as "none matched the expected shape" rather than as
// the missing-field error it really was.
function extractForDate(kind: GoogleHealthKind, point: Record<string, unknown>): string | null {
  if (kind === "sleep") {
    const interval = point.interval as { startTime?: string } | undefined;
    return typeof interval?.startTime === "string" ? interval.startTime.slice(0, 10) : null;
  }

  const date = point.date as { year?: unknown; month?: unknown; day?: unknown } | undefined;
  const { year, month, day } = date ?? {};
  if (typeof year !== "number" || typeof month !== "number" || typeof day !== "number") return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseGoogleHealthDataPoints(kind: GoogleHealthKind, json: unknown): GoogleHealthDataPoint[] {
  const dataPoints = (json as { dataPoints?: Array<Record<string, unknown>> }).dataPoints ?? [];
  const field = JSON_FIELD[kind];
  const results: GoogleHealthDataPoint[] = [];

  for (const raw of dataPoints) {
    const point = raw[field] as Record<string, unknown> | undefined;
    if (!point) continue;
    const forDate = extractForDate(kind, point);
    if (!forDate) continue;

    const { value, unit } = extractValue(kind, point);
    results.push({ forDate, value, unit });
  }

  // Silence here is the dangerous case: every row dropped looks exactly like
  // "no health data recorded" and syncs 0 points as a success. If Google
  // sent rows and none survived, the shape isn't what this parser expects —
  // say so, and carry a whole raw row so the correction is mechanical rather
  // than another round of guessing at field names.
  if (dataPoints.length > 0 && results.length === 0) {
    throw new Error(
      `Google Health returned ${dataPoints.length} ${kind} data point(s) but none matched the expected ` +
        `shape (${field}.${kind === "sleep" ? "interval.startTime" : "date"}). ` +
        `First raw point: ${JSON.stringify(dataPoints[0])}`,
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
