import { afterEach, describe, expect, it } from "vitest";
import { createUser, findUserByClerkId, listUsers, pingDatabase, prisma } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("pingDatabase", () => {
  it("returns true against a reachable database", async () => {
    expect(await pingDatabase()).toBe(true);
  });
});

describe("createUser / findUserByClerkId", () => {
  it("round-trips a user", async () => {
    const created = await makeUser("roundtrip");

    const found = await findUserByClerkId(created.clerkUserId);

    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe("roundtrip@example.com");
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("returns null for an unknown clerk id", async () => {
    expect(await findUserByClerkId("user_does_not_exist")).toBeNull();
  });
});

describe("listUsers", () => {
  it("returns users newest first with only the summary fields", async () => {
    const older = await makeUser("older");
    const newer = await makeUser("newer");

    const users = await listUsers();
    const ids = users.map((user) => user.id);

    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(Object.keys(users[0]).sort()).toEqual(["createdAt", "email", "id"]);
  });
});
