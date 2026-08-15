import { describe, expect, it } from "vitest";
import { buildCapacityTiles, sparklinePoints } from "../capacity";

type Reading = { kind: "sleep" | "rhr" | "hrv"; value: number; unit: string; forDate: Date };

// Oldest-first, as the graph reader returns them.
function readings(kind: Reading["kind"], unit: string, values: number[]): Reading[] {
  return values.map((value, index) => ({
    kind,
    value,
    unit,
    forDate: new Date(Date.UTC(2026, 7, 6 + index)),
  }));
}

describe("buildCapacityTiles", () => {
  it("returns nothing when there are no signals, so the section can hide entirely", () => {
    expect(buildCapacityTiles([])).toEqual([]);
  });

  it("formats sleep hours as hours and minutes", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [7.1, 6.8, 5.6667]));

    expect(tiles[0].value).toBe("5h 40m");
    expect(tiles[0].unit).toBeNull();
  });

  it("drops the minutes when a sleep value lands on the hour", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [6.5, 6.9, 7]));

    expect(tiles[0].value).toBe("7h");
  });

  it("keeps the unit beside the value for rhr and hrv", () => {
    const tiles = buildCapacityTiles([
      ...readings("rhr", "bpm", [53, 55, 58]),
      ...readings("hrv", "ms", [52, 47, 42]),
    ]);

    expect(tiles.map((t) => [t.value, t.unit])).toEqual([
      ["58", "bpm"],
      ["42", "ms"],
    ]);
  });

  // The baseline is the mean of everything BEFORE the latest reading — the
  // latest is what we are judging, so including it would drag the bar toward
  // itself and shrink every delta.
  it("measures the latest reading against the mean of the days before it", () => {
    const tiles = buildCapacityTiles(readings("rhr", "bpm", [50, 52, 54, 58]));

    // baseline = (50 + 52 + 54) / 3 = 52, so 58 is 6 above.
    expect(tiles[0].delta).toMatchObject({ text: "6 above", direction: "up" });
  });

  // Direction and tone are separate axes: for resting HR, up is worse.
  it("reads a rise in resting heart rate as strain, and a fall as recovery", () => {
    const rising = buildCapacityTiles(readings("rhr", "bpm", [52, 52, 58]));
    const falling = buildCapacityTiles(readings("rhr", "bpm", [58, 58, 52]));

    expect(rising[0].delta).toMatchObject({ direction: "up", tone: "strain" });
    expect(falling[0].delta).toMatchObject({ direction: "down", tone: "ok" });
  });

  it("reads a fall in sleep and hrv as strain, and a rise as recovery", () => {
    const tiles = buildCapacityTiles([
      ...readings("sleep", "hours", [7, 7, 5.5]),
      ...readings("hrv", "ms", [50, 50, 60]),
    ]);

    expect(tiles[0].delta).toMatchObject({ direction: "down", tone: "strain" });
    expect(tiles[1].delta).toMatchObject({ direction: "up", tone: "ok" });
  });

  it("formats a sleep delta of more than an hour as hours and minutes", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [7, 7, 5.6667]));

    expect(tiles[0].delta?.text).toBe("1h 20m below");
  });

  it("formats a sub-hour sleep delta as minutes alone", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [7, 7, 6.6667]));

    expect(tiles[0].delta?.text).toBe("20m below");
  });

  it("calls a negligible change flat rather than dressing noise as a trend", () => {
    const tiles = buildCapacityTiles(readings("rhr", "bpm", [58, 58, 58.2]));

    expect(tiles[0].delta?.tone).toBe("flat");
  });

  // Caught by rendering it: the amount rounded to zero but the phrasing still
  // claimed a direction, so the tile read "0 above".
  it("says steady, and claims no direction, when the change rounds away", () => {
    const tiles = buildCapacityTiles(readings("rhr", "bpm", [58, 58, 58.2]));

    expect(tiles[0].delta?.text).toBe("steady");
    expect(tiles[0].delta?.direction).toBeNull();
    expect(tiles[0].delta?.text).not.toMatch(/\b0\b/);
  });

  // A single reading has nothing to compare against. Rule §5 — when the
  // engine cannot determine something, it does not guess.
  it("omits the delta when there is no earlier reading to form a baseline", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [6.5]));

    expect(tiles[0].delta).toBeNull();
  });

  it("withholds the sparkline until there are at least three points", () => {
    const two = buildCapacityTiles(readings("hrv", "ms", [50, 52]));
    const three = buildCapacityTiles(readings("hrv", "ms", [50, 52, 54]));

    expect(two[0].spark).toBeNull();
    expect(three[0].spark).toEqual([50, 52, 54]);
  });

  it("orders tiles sleep, then resting heart rate, then hrv, whatever order they arrive in", () => {
    const tiles = buildCapacityTiles([
      ...readings("hrv", "ms", [42, 43]),
      ...readings("sleep", "hours", [7, 6]),
      ...readings("rhr", "bpm", [58, 57]),
    ]);

    expect(tiles.map((t) => t.kind)).toEqual(["sleep", "rhr", "hrv"]);
  });

  it("emits only the kinds that actually have readings", () => {
    const tiles = buildCapacityTiles(readings("sleep", "hours", [7, 6.5]));

    expect(tiles.map((t) => t.kind)).toEqual(["sleep"]);
  });
});

// Geometry lives here rather than in the component for the same reason the
// arithmetic does: this repo tests logic, not DOM, and a sparkline that plots
// the wrong shape is a correctness bug, not a styling one.
describe("sparklinePoints", () => {
  it("spans the box horizontally and puts the highest value at the top", () => {
    // y grows downward in SVG, so the max value gets the SMALLEST y.
    expect(sparklinePoints([1, 3, 2], 64, 20, 2)).toBe("2,18 32,2 62,10");
  });

  it("plots a flat line down the middle when every value is identical", () => {
    // Without this guard the normalisation divides by a zero range.
    expect(sparklinePoints([5, 5, 5], 64, 20, 2)).toBe("2,10 32,10 62,10");
  });

  // Also caught by rendering it: 58 → 58 → 58.2 is a 0.2 bpm wobble, but
  // normalising to the series' own min/max stretched it across the whole box
  // and drew a steep climb beside the word "steady".
  it("does not stretch a spread smaller than the noise floor to fill the box", () => {
    const noisy = sparklinePoints([58, 58, 58.2], 64, 20, 2, 0.5);

    const ys = noisy.split(" ").map((pair) => Number(pair.split(",")[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(8);
  });

  it("still spans the full box once the spread clears the noise floor", () => {
    const real = sparklinePoints([50, 54, 58], 64, 20, 2, 0.5);

    const ys = real.split(" ").map((pair) => Number(pair.split(",")[1]));
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(18);
  });

  it("keeps the marks inside the inset so a stroke is never clipped", () => {
    const ys = sparklinePoints([0, 10], 64, 20, 2)
      .split(" ")
      .map((pair) => Number(pair.split(",")[1]));

    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(18);
  });
});
