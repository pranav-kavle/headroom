// Capacity readings, turned into what the Brief renders.
//
// Core rule §1 — the engine computes, the model phrases. Every figure below
// (latest value, baseline, delta, tone) is arithmetic over stored
// CapacitySignal rows. Nothing here is ever produced by a model, and the
// component downstream only places these strings; it does no arithmetic.

export type CapacityKind = "sleep" | "rhr" | "hrv";
export type CapacityTone = "strain" | "ok" | "flat";

export interface CapacityReading {
  kind: CapacityKind | string;
  value: number;
  unit: string;
  forDate: Date;
}

export interface CapacityDelta {
  /** The whole phrase — "45m below", "3 above", "steady". */
  text: string;
  /** null when the change is below the noise floor and has no direction to claim. */
  direction: "up" | "down" | null;
  tone: CapacityTone;
}

export interface CapacityTile {
  kind: CapacityKind;
  label: string;
  value: string;
  unit: string | null;
  delta: CapacityDelta | null;
  spark: number[] | null;
  /**
   * The smallest spread the sparkline is allowed to stretch to fill its box.
   * Without it, a series normalised to its own min/max turns a 0.2 bpm wobble
   * into a dramatic climb — a picture contradicting the "steady" beside it.
   */
  sparkMinRange: number;
}

// Fixed display order, independent of the order rows arrive in.
const KINDS: CapacityKind[] = ["sleep", "rhr", "hrv"];

const LABEL: Record<CapacityKind, string> = {
  sleep: "Sleep",
  rhr: "Resting HR",
  hrv: "HRV",
};

// Which way is better differs per metric: more sleep and higher HRV are
// recovery, but a HIGHER resting heart rate is strain. Deriving tone from the
// arrow alone would be wrong for exactly one of the three.
const HIGHER_IS_BETTER: Record<CapacityKind, boolean> = {
  sleep: true,
  rhr: false,
  hrv: true,
};

// Below these, a change is noise, not a trend — reported as flat rather than
// given a direction it hasn't earned.
const NEGLIGIBLE: Record<CapacityKind, number> = {
  sleep: 0.1, // 6 minutes
  rhr: 0.5, // bpm
  hrv: 0.5, // ms
};

// Two points draw a straight line that reads as a trend without being one.
const MIN_SPARK_POINTS = 3;

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatValue(kind: CapacityKind, value: number): string {
  return kind === "sleep" ? formatHours(value) : `${Math.round(value)}`;
}

function formatAmount(kind: CapacityKind, magnitude: number): string {
  return kind === "sleep" ? formatHours(magnitude) : `${Math.round(magnitude)}`;
}

function toneFor(kind: CapacityKind, delta: number): CapacityTone {
  if (Math.abs(delta) < NEGLIGIBLE[kind]) return "flat";
  const improving = delta > 0 === HIGHER_IS_BETTER[kind];
  return improving ? "ok" : "strain";
}

function tileFor(kind: CapacityKind, readings: CapacityReading[]): CapacityTile | null {
  if (readings.length === 0) return null;

  const values = readings.map((reading) => reading.value);
  const latest = values[values.length - 1];
  const earlier = values.slice(0, -1);

  // The latest reading is the thing being judged, so the baseline is the mean
  // of the days before it. Including it would pull the baseline toward itself.
  let delta: CapacityDelta | null = null;
  if (earlier.length > 0) {
    const baseline = earlier.reduce((sum, value) => sum + value, 0) / earlier.length;
    const difference = latest - baseline;
    const tone = toneFor(kind, difference);
    delta =
      tone === "flat"
        ? // A change under the noise floor has no direction worth naming, and
          // rounding it produces things like "0 above".
          { text: "steady", direction: null, tone }
        : {
            text: `${formatAmount(kind, Math.abs(difference))} ${difference > 0 ? "above" : "below"}`,
            direction: difference > 0 ? "up" : "down",
            tone,
          };
  }

  return {
    kind,
    label: LABEL[kind],
    value: formatValue(kind, latest),
    unit: kind === "sleep" ? null : readings[readings.length - 1].unit,
    delta,
    spark: values.length >= MIN_SPARK_POINTS ? values : null,
    sparkMinRange: NEGLIGIBLE[kind],
  };
}

/**
 * Normalises a series into `x,y` pairs for an SVG polyline.
 *
 * Each sparkline is scaled to its OWN min/max — these are three different
 * measures (hours, bpm, ms) and forcing them onto a shared scale would be the
 * dual-axis mistake in disguise. The shape carries the trend; the tile's value
 * and delta carry the magnitude.
 */
export function sparklineCoords(
  values: number[],
  width = 64,
  height = 20,
  inset = 2,
  minRange = 0,
): Array<{ x: number; y: number }> {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Floored, not raw: a series whose whole spread is under the noise floor
  // would otherwise be stretched to fill the box and read as a steep trend.
  const range = Math.max(max - min, minRange);
  const span = width - inset * 2;
  const rise = height - inset * 2;

  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : inset + (index / (values.length - 1)) * span;
    // A perfectly flat series has no range to normalise against — centre it
    // rather than divide by zero and paint NaN into the DOM. With a floored
    // range, a near-flat series lands near the centre too, which is the point.
    const y = range === 0 ? height / 2 : inset + (1 - (value - min) / range) * rise;
    return { x: round(x), y: round(y) };
  });
}

/** The same coordinates as an SVG `points` attribute. */
export function sparklinePoints(
  values: number[],
  width = 64,
  height = 20,
  inset = 2,
  minRange = 0,
): string {
  return sparklineCoords(values, width, height, inset, minRange)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

// Two decimals is well past sub-pixel at these sizes, and keeps the markup
// readable instead of full of floating-point tails.
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds one tile per kind that has readings, in fixed display order.
 * Readings must arrive oldest-first, as `listRecentCapacitySignals` returns
 * them. Kinds with no readings are omitted rather than rendered empty, so a
 * user with only some sources connected sees only what is real.
 */
export function buildCapacityTiles(readings: CapacityReading[]): CapacityTile[] {
  return KINDS.map((kind) =>
    tileFor(
      kind,
      readings.filter((reading) => reading.kind === kind),
    ),
  ).filter((tile): tile is CapacityTile => tile !== null);
}
