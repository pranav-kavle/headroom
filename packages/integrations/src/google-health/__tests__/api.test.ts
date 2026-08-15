import { describe, expect, it } from "vitest";
import { fetchGoogleHealthDataPoints, parseGoogleHealthDataPoints } from "../api";

describe("parseGoogleHealthDataPoints", () => {
  // The live shape, not the guessed one: minutesAsleep lives under `summary`,
  // and as an int64 it arrives as a JSON *string*. Reading `sleep.minutesAsleep`
  // as a number missed on both counts (2026-08-15).
  it("parses sleep minutes into hours from the summary's int64 string", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/sleep/dataPoints/1",
          sleep: {
            interval: { startTime: "2026-08-13T22:00:00Z", endTime: "2026-08-14T05:12:00Z" },
            type: "SLEEP_TYPE_STAGES",
            stages: [{ startTime: "2026-08-13T22:00:00Z", endTime: "2026-08-13T23:00:00Z", type: "LIGHT" }],
            metadata: {},
            summary: {
              stagesSummary: [],
              minutesInSleepPeriod: "452",
              minutesToFallAsleep: "8",
              minutesAsleep: "432",
              minutesAwake: "20",
            },
            createTime: "2026-08-14T06:00:00Z",
            updateTime: "2026-08-14T06:00:00Z",
            shortAwakenings: 3,
          },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("sleep", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 7.2, unit: "hours" }]);
  });

  // Proto3 JSON permits an int64 as a bare number too, and nothing about the
  // reading changes if Google ever sends one.
  it("accepts a numeric minutesAsleep as well as the string form", () => {
    const json = {
      dataPoints: [
        {
          name: "n",
          sleep: { interval: { startTime: "2026-08-13T22:00:00Z" }, summary: { minutesAsleep: 432 } },
        },
      ],
    };

    expect(parseGoogleHealthDataPoints("sleep", json)).toEqual([
      { forDate: "2026-08-13", value: 7.2, unit: "hours" },
    ]);
  });

  // The error that sent us round this loop twice named only the top-level
  // keys, which said "minutesAsleep is missing" while it sat one level down.
  // Naming the summary's keys too makes the next shape surprise mechanical.
  it("names both the sleep and summary keys when minutesAsleep is missing", () => {
    const json = {
      dataPoints: [
        {
          name: "n",
          sleep: { interval: { startTime: "2026-08-13T22:00:00Z" }, summary: { minutesAwake: "20" } },
        },
      ],
    };

    expect(() => parseGoogleHealthDataPoints("sleep", json)).toThrow(/summary keys: minutesAwake/);
  });

  // Daily types have no `interval` at all — they carry a civil
  // google.type.Date of integers. Requiring interval.startTime for every kind
  // dropped every RHR and HRV row. beatsPerMinute is int64, so a string too.
  it("parses resting heart rate in bpm from a civil date and an int64 string", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/daily-resting-heart-rate/dataPoints/1",
          dailyRestingHeartRate: {
            date: { year: 2026, month: 8, day: 13 },
            dailyRestingHeartRateMetadata: {},
            beatsPerMinute: "58",
          },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("rhr", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 58, unit: "bpm" }]);
  });

  // Single-digit months and days have to zero-pad, or forDate stops being an
  // ISO date and the "2026-8-3" string silently misfiles the reading.
  it("zero-pads a single-digit month and day", () => {
    const json = {
      dataPoints: [
        { name: "n", dailyRestingHeartRate: { date: { year: 2026, month: 8, day: 3 }, beatsPerMinute: "58" } },
      ],
    };

    expect(parseGoogleHealthDataPoints("rhr", json)[0].forDate).toBe("2026-08-03");
  });

  it("parses HRV from averageHeartRateVariabilityMilliseconds", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/daily-heart-rate-variability/dataPoints/1",
          dailyHeartRateVariability: {
            date: { year: 2026, month: 8, day: 13 },
            averageHeartRateVariabilityMilliseconds: 42,
            deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 51.7,
            nonRemHeartRateBeatsPerMinute: "54",
          },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("hrv", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 42, unit: "ms" }]);
  });

  // Deep-sleep RMSSD is a different measure, not a stand-in. Silently
  // substituting it on days the average is absent would make the baseline
  // comparison read a field switch as a physiological change.
  it("refuses to substitute deep-sleep RMSSD when the average is absent", () => {
    const json = {
      dataPoints: [
        {
          name: "n",
          dailyHeartRateVariability: {
            date: { year: 2026, month: 8, day: 13 },
            deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 51.7,
          },
        },
      ],
    };

    expect(() => parseGoogleHealthDataPoints("hrv", json)).toThrow(
      /averageHeartRateVariabilityMilliseconds/,
    );
  });

  it("skips a daily data point missing its date while keeping the rest", () => {
    const json = {
      dataPoints: [
        { name: "n", dailyRestingHeartRate: { beatsPerMinute: "58" } },
        { name: "n2", dailyRestingHeartRate: { date: { year: 2026, month: 8, day: 13 }, beatsPerMinute: "60" } },
      ],
    };

    expect(parseGoogleHealthDataPoints("rhr", json)).toEqual([{ forDate: "2026-08-13", value: 60, unit: "bpm" }]);
  });

  it("returns empty without complaint when Google genuinely sent no data points", () => {
    expect(parseGoogleHealthDataPoints("rhr", { dataPoints: [] })).toEqual([]);
  });

  // Dropping every point silently reads as "you have no health data" and
  // reports 0 synced, which is indistinguishable from success. If Google
  // sent rows and we understood none of them, that's a shape mismatch and
  // it has to say so — with the raw row, so the fix needs no guessing.
  it("throws with the raw data point when every row was dropped as unrecognized", () => {
    const json = {
      dataPoints: [{ name: "n", sleep: { startTime: "2026-08-13T22:00:00Z", endTime: "2026-08-14T05:12:00Z" } }],
    };

    expect(() => parseGoogleHealthDataPoints("sleep", json)).toThrow(/startTime/);
  });
});

describe("fetchGoogleHealthDataPoints", () => {
  it("requests the right data type path with a bearer token", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init! });
      return new Response(JSON.stringify({ dataPoints: [] }));
    };

    await fetchGoogleHealthDataPoints({
      kind: "sleep",
      token: "ya29_test",
      sinceDate: "2026-08-07",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(calls[0].url).toContain("https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer ya29_test");
  });

  it("maps the rhr kind to the daily-resting-heart-rate path", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL) => {
      calls.push(url.toString());
      return new Response(JSON.stringify({ dataPoints: [] }));
    };

    await fetchGoogleHealthDataPoints({
      kind: "rhr",
      token: "ya29_test",
      sinceDate: "2026-08-07",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(calls[0]).toContain("/dataTypes/daily-resting-heart-rate/dataPoints");
  });

  // Each record type has its own filterable time member (AIP-160): Session
  // types filter on interval.end_time, Daily types on a date-only `date`.
  // Sending interval.start_time for all three is what produced
  // INVALID_DATA_POINT_FILTER_DATA_TYPE_MEMBER against the live API.
  it("filters sleep, a Session type, on its interval end time", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL) => {
      calls.push(url.toString());
      return new Response(JSON.stringify({ dataPoints: [] }));
    };

    await fetchGoogleHealthDataPoints({
      kind: "sleep",
      token: "t",
      sinceDate: "2026-08-07",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(decodeURIComponent(calls[0].replace(/\+/g, " "))).toContain('sleep.interval.end_time >= "2026-08-07T00:00:00Z"');
  });

  it("filters the daily kinds on a date-only `date` member", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL) => {
      calls.push(url.toString());
      return new Response(JSON.stringify({ dataPoints: [] }));
    };

    for (const kind of ["rhr", "hrv"] as const) {
      await fetchGoogleHealthDataPoints({ kind, token: "t", sinceDate: "2026-08-07", fetchImpl: fetchImpl as typeof fetch });
    }

    expect(decodeURIComponent(calls[0].replace(/\+/g, " "))).toContain('daily_resting_heart_rate.date >= "2026-08-07"');
    expect(decodeURIComponent(calls[1].replace(/\+/g, " "))).toContain('daily_heart_rate_variability.date >= "2026-08-07"');
  });

  it("throws a named error when Google returns an error response", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: "Invalid Credentials" } }), { status: 401 });

    await expect(
      fetchGoogleHealthDataPoints({
        kind: "hrv",
        token: "bad",
        sinceDate: "2026-08-07",
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow(/Invalid Credentials/);
  });
});
