import { afterEach, describe, expect, it } from "vitest";
import { createUser, getConnectorCursor, listConnectorCursors, prisma, upsertConnectorCursor } from "../index";

const clerkIds: string[] = [];
const userIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_${suffix}`;
  clerkIds.push(clerkUserId);
  const user = await createUser({ clerkUserId, email: `${suffix}@example.com` });
  userIds.push(user.id);
  return user;
}

afterEach(async () => {
  if (userIds.length > 0) {
    await prisma.connectorCursor.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    userIds.length = 0;
    clerkIds.length = 0;
  }
});

describe("listConnectorCursors", () => {
  it("returns only the calling user's cursors", async () => {
    const owner = await makeUser("cursors-owner");
    const other = await makeUser("cursors-other");
    await prisma.connectorCursor.create({
      data: { userId: owner.id, source: "gmail", status: "idle" },
    });
    await prisma.connectorCursor.create({
      data: { userId: other.id, source: "gmail", status: "idle" },
    });

    const cursors = await listConnectorCursors(owner.id);

    expect(cursors).toHaveLength(1);
    expect(cursors[0].userId).toBe(owner.id);
  });

  it("returns an empty array when nothing is connected", async () => {
    const user = await makeUser("cursors-empty");

    expect(await listConnectorCursors(user.id)).toEqual([]);
  });

  it("surfaces status, lastSyncedAt, and errorMessage", async () => {
    const user = await makeUser("cursors-status");
    await prisma.connectorCursor.create({
      data: {
        userId: user.id,
        source: "google_health",
        status: "error",
        errorMessage: "token expired",
      },
    });

    const [cursor] = await listConnectorCursors(user.id);

    expect(cursor.status).toBe("error");
    expect(cursor.errorMessage).toBe("token expired");
    expect(cursor.lastSyncedAt).toBeNull();
  });
});

describe("upsertConnectorCursor", () => {
  it("creates a cursor row with running status", async () => {
    const user = await makeUser("cursor_create");

    const cursor = await upsertConnectorCursor({ userId: user.id, source: "github", status: "running" });

    expect(cursor.status).toBe("running");
    expect(cursor.lastSyncedAt).toBeNull();
  });

  it("updates the same row on a second call rather than creating another", async () => {
    const user = await makeUser("cursor_update");
    await upsertConnectorCursor({ userId: user.id, source: "github", status: "running" });
    const syncedAt = new Date("2026-08-14T12:00:00.000Z");

    const updated = await upsertConnectorCursor({
      userId: user.id,
      source: "github",
      status: "idle",
      lastSyncedAt: syncedAt,
      errorMessage: null,
    });

    expect(updated.status).toBe("idle");
    expect(updated.lastSyncedAt).toEqual(syncedAt);
    const rows = await prisma.connectorCursor.findMany({ where: { userId: user.id, source: "github" } });
    expect(rows).toHaveLength(1);
  });

  it("records an error message", async () => {
    const user = await makeUser("cursor_error");

    const cursor = await upsertConnectorCursor({
      userId: user.id,
      source: "github",
      status: "error",
      errorMessage: "GitHub is not connected yet.",
    });

    expect(cursor.status).toBe("error");
    expect(cursor.errorMessage).toBe("GitHub is not connected yet.");
  });

  it("stores and returns a resume cursor payload", async () => {
    const user = await makeUser("cursor_payload");

    await upsertConnectorCursor({
      userId: user.id,
      source: "slack",
      status: "idle",
      cursor: { channels: { C1: "1723680000.000100" } },
    });

    const row = await getConnectorCursor(user.id, "slack");
    expect(row?.cursor).toEqual({ channels: { C1: "1723680000.000100" } });
  });

  it("leaves an existing cursor payload alone on a status-only update", async () => {
    // runIntegrationSync flips status to running/idle around every sync
    // without knowing anything about the payload. If those calls wrote
    // `cursor: null` by omission, every Slack sync would silently re-ingest
    // the entire message history.
    const user = await makeUser("cursor_preserve");
    await upsertConnectorCursor({
      userId: user.id,
      source: "slack",
      status: "idle",
      cursor: { channels: { C1: "1723680000.000100" } },
    });

    await upsertConnectorCursor({ userId: user.id, source: "slack", status: "running" });

    const row = await getConnectorCursor(user.id, "slack");
    expect(row?.status).toBe("running");
    expect(row?.cursor).toEqual({ channels: { C1: "1723680000.000100" } });
  });
});

describe("getConnectorCursor", () => {
  it("returns null when the source has never synced", async () => {
    const user = await makeUser("cursor_absent");

    expect(await getConnectorCursor(user.id, "slack")).toBeNull();
  });
});
