import { afterEach, describe, expect, it } from "vitest";
import {
  completeOnboarding,
  createUser,
  findUserByClerkId,
  listUsers,
  pingDatabase,
  prisma,
} from "../index";

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

describe("completeOnboarding", () => {
  it("stores the profile and stamps onboardedAt", async () => {
    const user = await makeUser("onboard");
    expect(user.onboardedAt).toBeNull();

    const updated = await completeOnboarding(user.id, {
      displayName: "Pranav",
      role: "Corporate lawyer at Sidley",
      timezone: "America/New_York",
    });

    expect(updated.displayName).toBe("Pranav");
    expect(updated.role).toBe("Corporate lawyer at Sidley");
    expect(updated.timezone).toBe("America/New_York");
    expect(updated.onboardedAt).toBeInstanceOf(Date);
  });

  it("keeps the optional answers null when they are skipped", async () => {
    const user = await makeUser("skipped");

    const updated = await completeOnboarding(user.id, { displayName: "Pranav" });

    expect(updated.displayName).toBe("Pranav");
    expect(updated.role).toBeNull();
    expect(updated.timezone).toBeNull();
    expect(updated.onboardedAt).toBeInstanceOf(Date);
  });

  // onboardedAt answers "when did this person first arrive", so re-running the
  // flow must not rewrite it — otherwise the one durable signal we have about
  // account age silently resets.
  it("does not move onboardedAt when run a second time", async () => {
    const user = await makeUser("rerun");
    const first = await completeOnboarding(user.id, { displayName: "Pranav" });

    const second = await completeOnboarding(user.id, { displayName: "Pranav K" });

    expect(second.displayName).toBe("Pranav K");
    expect(second.onboardedAt).toEqual(first.onboardedAt);
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
