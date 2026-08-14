import { upsertConnectorCursor } from "@headroom/graph";
import type { ArtifactSource } from "@headroom/graph";

/**
 * The one piece of connector machinery every source integration needs,
 * extracted here before a second consumer exists because GitHub's own sync
 * (Task 9) exercises every branch immediately — design doc §4: "every
 * connector is a throttled, resumable job... every connector stores a
 * cursor." Marks the cursor `running` before `run`, `idle` with a fresh
 * `lastSyncedAt` on success, `error` with the message on failure, and
 * rethrows so the caller (an API route) can respond appropriately.
 */
export async function runIntegrationSync<T>(
  input: { userId: string; source: ArtifactSource; now: Date },
  run: () => Promise<T>,
): Promise<T> {
  await upsertConnectorCursor({ userId: input.userId, source: input.source, status: "running" });

  try {
    const result = await run();
    await upsertConnectorCursor({
      userId: input.userId,
      source: input.source,
      status: "idle",
      lastSyncedAt: input.now,
      errorMessage: null,
    });
    return result;
  } catch (error) {
    await upsertConnectorCursor({
      userId: input.userId,
      source: input.source,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
