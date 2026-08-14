import { afterEach, describe, expect, it } from "vitest";
import { createUser, ensureSelfPerson, prisma, resolvePerson } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_people_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.user.updateMany({ where: { clerkUserId: { in: clerkIds } }, data: { selfPersonId: null } });
    await prisma.identity.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.person.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("resolvePerson", () => {
  it("creates a Person and Identity together on first sight", async () => {
    const user = await makeUser("resolve_new");

    const person = await resolvePerson({
      userId: user.id,
      kind: "github",
      value: "mrodriguez",
      confidence: 1,
      displayName: "mrodriguez",
      githubLogin: "mrodriguez",
    });

    expect(person.githubLogin).toBe("mrodriguez");
    const identity = await prisma.identity.findUnique({
      where: { userId_kind_value: { userId: user.id, kind: "github", value: "mrodriguez" } },
    });
    expect(identity?.personId).toBe(person.id);
    expect(identity?.confidence.toNumber()).toBe(1);
  });

  it("returns the same Person on a second resolution of the same identity", async () => {
    const user = await makeUser("resolve_repeat");
    const first = await resolvePerson({
      userId: user.id,
      kind: "github",
      value: "mrodriguez",
      confidence: 1,
      displayName: "mrodriguez",
      githubLogin: "mrodriguez",
    });

    const second = await resolvePerson({
      userId: user.id,
      kind: "github",
      value: "mrodriguez",
      confidence: 1,
      displayName: "changed-name-should-be-ignored",
      githubLogin: "mrodriguez",
    });

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("mrodriguez");
    const identities = await prisma.identity.findMany({ where: { userId: user.id } });
    expect(identities).toHaveLength(1);
  });
});

describe("ensureSelfPerson", () => {
  it("creates the self Person and links User.selfPersonId", async () => {
    const user = await makeUser("self_new");

    const self = await ensureSelfPerson({ userId: user.id, displayName: "Pranav", githubLogin: "pranav-kavle" });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.selfPersonId).toBe(self.id);
    expect(self.githubLogin).toBe("pranav-kavle");
  });

  it("returns the existing self Person on a second call", async () => {
    const user = await makeUser("self_repeat");
    const first = await ensureSelfPerson({ userId: user.id, displayName: "Pranav" });

    const second = await ensureSelfPerson({ userId: user.id, displayName: "ignored" });

    expect(second.id).toBe(first.id);
  });
});
