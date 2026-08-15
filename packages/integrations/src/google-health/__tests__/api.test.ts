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

  it("skips data points missing an interval start time", () => {
    const json = {
      dataPoints: [{ name: "n", dailyRestingHeartRate: { beatsPerMinute: 58 } }],
    };

    expect(parseGoogleHealthDataPoints("rhr", json)).toEqual([]);
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
