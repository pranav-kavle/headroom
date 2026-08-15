import { createArtifact, upsertCapacitySignal } from "@headroom/graph";
import type { CapacitySignalKind } from "@headroom/graph";
import { runIntegrationSync } from "../sync-run";
import { fetchGoogleHealthDataPoints, type GoogleHealthDataPoint, type GoogleHealthKind } from "./api";

export interface GoogleHealthSyncSummary {
  pointsSynced: number;
}

// Same trailing-window rationale as the calendar connector — wearables sync
// with lag, so each run recomputes rather than trusting a moving cursor.
const TRAILING_DAYS = 7;
const KINDS: GoogleHealthKind[] = ["sleep", "rhr", "hrv"];

function excerptFor(kind: GoogleHealthKind, point: GoogleHealthDataPoint): string {
  if (kind === "sleep") return `${point.value}h sleep`;
  if (kind === "rhr") return `RHR ${point.value} ${point.unit}`;
  return `HRV ${point.value} ${point.unit}`;
}

export async function syncGoogleHealth(input: {
  userId: string;
  token: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<GoogleHealthSyncSummary> {
  return runIntegrationSync({ userId: input.userId, source: "google_health", now: input.now }, async () => {
    const since = new Date(input.now);
    since.setUTCDate(since.getUTCDate() - TRAILING_DAYS);
    const sinceDate = since.toISOString().slice(0, 10);

    let pointsSynced = 0;

    for (const kind of KINDS) {
      const points = await fetchGoogleHealthDataPoints({
        kind,
        token: input.token,
        sinceDate,
        fetchImpl: input.fetchImpl,
      });

      for (const point of points) {
        const forDate = new Date(`${point.forDate}T00:00:00.000Z`);

        // A fresh artifact per data point, same reasoning as the calendar
        // connector: each sync's reading is its own immutable, timestamped
        // claim, not an edit to a shared record.
        const artifact = await createArtifact({
          userId: input.userId,
          source: "google_health",
          occurredAt: forDate,
          excerpt: excerptFor(kind, point),
        });

        await upsertCapacitySignal({
          userId: input.userId,
          kind: kind as CapacitySignalKind,
          value: point.value,
          unit: point.unit,
          forDate,
          sourceArtifactId: artifact.id,
        });
        pointsSynced += 1;
      }
    }

    return { pointsSynced };
  });
}
