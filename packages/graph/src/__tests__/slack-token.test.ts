import { afterEach, describe, expect, it } from "vitest";
import { createUser, getSlackToken, prisma, upsertSlackToken } from "../index";

const clerkIds: string[] = [];

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_slack_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    await prisma.slackToken.deleteMany({ where: { user: { clerkUserId: { in: clerkIds } } } });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

const ENCRYPTED_ACCESS = { encrypted: "enc-slack-1", iv: "iv-slack-1", authTag: "tag-slack-1" };

describe("getSlackToken", () => {
  it("returns null when the user has never connected", async () => {
    const user = await makeUser("missing");
    expect(await getSlackToken(user.id)).toBeNull();
  });
});

describe("upsertSlackToken", () => {
  it("creates a token row, storing the encrypted bundle as-is", async () => {
    const user = await makeUser("create");

    const token = await upsertSlackToken({
      userId: user.id,
      accessToken: ENCRYPTED_ACCESS,
      teamId: "T04AB",
      slackUserId: "U04CD",
    });

    expect(token.userId).toBe(user.id);
    expect(token.accessToken).toEqual(ENCRYPTED_ACCESS);
    expect(token.teamId).toBe("T04AB");
    expect(token.slackUserId).toBe("U04CD");

    const found = await getSlackToken(user.id);
    expect(found?.accessToken).toEqual(ENCRYPTED_ACCESS);
    expect(found?.slackUserId).toBe("U04CD");
  });

  it("replaces the existing row when the user reconnects", async () => {
    const user = await makeUser("replace");
    await upsertSlackToken({
      userId: user.id,
      accessToken: ENCRYPTED_ACCESS,
      teamId: "T04AB",
      slackUserId: "U04CD",
    });

    // Reinstalling into a different workspace has to overwrite rather than
    // accumulate — a stale teamId would build permalinks pointing at the
    // wrong Slack domain.
    const newAccess = { encrypted: "enc-slack-2", iv: "iv-slack-2", authTag: "tag-slack-2" };
    const updated = await upsertSlackToken({
      userId: user.id,
      accessToken: newAccess,
      teamId: "T99ZZ",
      slackUserId: "U99YY",
    });

    expect(updated.accessToken).toEqual(newAccess);
    expect(updated.teamId).toBe("T99ZZ");
    const rows = await prisma.slackToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });
});
