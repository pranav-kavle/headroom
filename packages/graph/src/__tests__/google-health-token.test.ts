import { afterEach, describe, expect, it } from "vitest";
import { createUser, getGoogleHealthToken, prisma, upsertGoogleHealthToken } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_ght_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.googleHealthToken.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

const ENCRYPTED_ACCESS = { encrypted: "enc-access-1", iv: "iv-access-1", authTag: "tag-access-1" };
const ENCRYPTED_REFRESH = { encrypted: "enc-refresh-1", iv: "iv-refresh-1", authTag: "tag-refresh-1" };

describe("getGoogleHealthToken", () => {
  it("returns null when the user has never connected", async () => {
    const user = await makeUser("missing");
    expect(await getGoogleHealthToken(user.id)).toBeNull();
  });
});

describe("upsertGoogleHealthToken", () => {
  it("creates a token row, storing the encrypted bundles as-is", async () => {
    const user = await makeUser("create");
    const expiresAt = new Date("2026-08-15T04:00:00.000Z");

    const token = await upsertGoogleHealthToken({
      userId: user.id,
      accessToken: ENCRYPTED_ACCESS,
      refreshToken: ENCRYPTED_REFRESH,
      expiresAt,
    });

    expect(token.userId).toBe(user.id);
    expect(token.accessToken).toEqual(ENCRYPTED_ACCESS);
    expect(token.refreshToken).toEqual(ENCRYPTED_REFRESH);
    expect(token.expiresAt).toEqual(expiresAt);

    const found = await getGoogleHealthToken(user.id);
    expect(found?.accessToken).toEqual(ENCRYPTED_ACCESS);
  });

  it("replaces the existing row on a repeat connect/refresh", async () => {
    const user = await makeUser("replace");
    await upsertGoogleHealthToken({
      userId: user.id,
      accessToken: ENCRYPTED_ACCESS,
      refreshToken: ENCRYPTED_REFRESH,
      expiresAt: new Date("2026-08-15T04:00:00.000Z"),
    });

    const newAccess = { encrypted: "enc-access-2", iv: "iv-access-2", authTag: "tag-access-2" };
    const updated = await upsertGoogleHealthToken({
      userId: user.id,
      accessToken: newAccess,
      refreshToken: ENCRYPTED_REFRESH,
      expiresAt: new Date("2026-08-15T05:00:00.000Z"),
    });

    expect(updated.accessToken).toEqual(newAccess);
    const rows = await prisma.googleHealthToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });
});
