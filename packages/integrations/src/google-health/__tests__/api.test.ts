import { describe, expect, it } from "vitest";
import { fetchGoogleHealthDataPoints, parseGoogleHealthDataPoints } from "../api";

describe("parseGoogleHealthDataPoints", () => {
  it("parses sleep minutes into hours", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/sleep/dataPoints/1",
          sleep: { interval: { startTime: "2026-08-13T22:00:00Z", endTime: "2026-08-14T05:12:00Z" }, minutesAsleep: 432 },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("sleep", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 7.2, unit: "hours" }]);
  });

  it("parses resting heart rate in bpm", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/daily-resting-heart-rate/dataPoints/1",
          dailyRestingHeartRate: { interval: { startTime: "2026-08-13T00:00:00Z" }, beatsPerMinute: 58 },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("rhr", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 58, unit: "bpm" }]);
  });

  it("parses HRV in milliseconds when the rmssdMillis field is present", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/daily-heart-rate-variability/dataPoints/1",
          dailyHeartRateVariability: { interval: { startTime: "2026-08-13T00:00:00Z" }, rmssdMillis: 42 },
        },
      ],
    };

    const result = parseGoogleHealthDataPoints("hrv", json);

    expect(result).toEqual([{ forDate: "2026-08-13", value: 42, unit: "ms" }]);
  });

  it("throws a named, actionable error when an HRV data point has an unrecognized shape", () => {
    const json = {
      dataPoints: [
        {
          name: "users/me/dataTypes/daily-heart-rate-variability/dataPoints/1",
          dailyHeartRateVariability: { interval: { startTime: "2026-08-13T00:00:00Z" }, somethingElse: 42 },
        },
      ],
    };

    expect(() => parseGoogleHealthDataPoints("hrv", json)).toThrow(/unrecognized shape/i);
  });

  it("skips a data point missing an interval start time while keeping the rest", () => {
    const json = {
      dataPoints: [
        { name: "n", dailyRestingHeartRate: { beatsPerMinute: 58 } },
        { name: "n2", dailyRestingHeartRate: { interval: { startTime: "2026-08-13T00:00:00Z" }, beatsPerMinute: 60 } },
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
