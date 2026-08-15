import type { CapacityTile } from "@/lib/capacity";
import { sparklineCoords } from "@/lib/capacity";
import styles from "./CapacityTiles.module.css";

const WIDTH = 64;
const HEIGHT = 20;
const INSET = 2;

/**
 * A seven-day trend line, scaled to its OWN series.
 *
 * Three measures on different units (hours, bpm, ms) must never share a scale
 * — that is the dual-axis mistake wearing a different hat. The shape carries
 * the trend; the tile's value and delta carry the magnitude.
 */
function Sparkline({
  values,
  label,
  minRange,
}: {
  values: number[];
  label: string;
  minRange: number;
}) {
  const coords = sparklineCoords(values, WIDTH, HEIGHT, INSET, minRange);
  const last = coords[coords.length - 1];

  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, last ${values.length} readings: ${values.join(", ")}`}
    >
      <polyline points={coords.map((point) => `${point.x},${point.y}`).join(" ")} />
      <circle cx={last.x} cy={last.y} r={2.4} />
    </svg>
  );
}

/**
 * Sleep, resting heart rate and HRV as three readings side by side.
 *
 * A KPI row of stat tiles rather than a chart — see `Sparkline` above for why
 * they are not one plot.
 *
 * Design doc §47 — health is a capacity constraint on planning, never a
 * wellness coach. Hence the section reads "Capacity", and each tile states a
 * deviation from *your own* baseline rather than passing judgement on it.
 *
 * Purely presentational: every figure and every tone arrives precomputed from
 * `@/lib/capacity`, which is where the tests live. This does no arithmetic.
 */
export function CapacityTiles({ tiles }: { tiles: CapacityTile[] }) {
  // Nothing synced yet means no section at all — not a row of dashes. Rule §5:
  // when the engine can't determine something, it doesn't guess.
  if (tiles.length === 0) return null;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Capacity</h2>
        <div className={styles.when}>last night &middot; vs 7-day baseline</div>
      </div>

      <div className={styles.row}>
        {tiles.map((tile) => (
          <div className={styles.tile} key={tile.kind}>
            <div className={styles.label}>{tile.label}</div>
            <div className={styles.value}>
              {tile.value}
              {tile.unit && <span className={styles.unit}>{tile.unit}</span>}
            </div>

            {tile.spark && (
              <Sparkline values={tile.spark} label={tile.label} minRange={tile.sparkMinRange} />
            )}

            {tile.delta && (
              // The arrow and the words carry the state as well as the colour
              // does — a delta is never colour alone. A steady reading gets no
              // arrow, because it has no direction to point.
              <div className={styles.delta} data-tone={tile.delta.tone}>
                {tile.delta.direction && (
                  <span className={styles.arrow} aria-hidden="true">
                    {tile.delta.direction === "up" ? "▲" : "▼"}
                  </span>
                )}
                <span>{tile.delta.text}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
