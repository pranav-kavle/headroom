import { afterEach, describe, expect, it } from "vitest";
import {
  createProposedAction,
  createUser,
  findApprovableAction,
  listActions,
  markActionExecuted,
  markActionFailed,
  prisma,
  startAgentRun,
} from "../index";

const clerkIds: string[] = [];
const AT = new Date("2026-08-15T07:00:00.000Z");
// Comfortably before AT, so the expiry window is open for every test that
// isn't specifically testing expiry.
const WINDOW_START = new Date("2026-08-15T06:45:00.000Z");

async function makeUser(suffix: string) {
  const clerkUserId = `user_test_action_${suffix}`;
  clerkIds.push(clerkUserId);
  return createUser({ clerkUserId, email: `${suffix}@example.com` });
}

async function makeRun(userId: string, turnId: string) {
  return startAgentRun({ userId, turnId, at: AT });
}

afterEach(async () => {
  if (clerkIds.length > 0) {
    const where = { user: { clerkUserId: { in: clerkIds } } };
    await prisma.action.deleteMany({ where });
    await prisma.agentRun.deleteMany({ where });
    await prisma.triggerEvent.deleteMany({ where });
    await prisma.artifact.deleteMany({ where });
    await prisma.user.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
    clerkIds.length = 0;
  }
});

describe("startAgentRun", () => {
  it("opens a trigger event and a run, which an Action requires to exist at all", async () => {
    const user = await makeUser("run");

    const run = await makeRun(user.id, "turn-1");

    expect(run.status).toBe("running");
    expect(run.triggerEventId).toBeTruthy();
  });
});

describe("findApprovableAction", () => {
  const PAYLOAD = { artifactId: "a1", body: "demo successful" };

  it("finds an offer made in an earlier run", async () => {
    const user = await makeUser("approve");
    const first = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    const second = await makeRun(user.id, "turn-2");

    const found = await findApprovableAction({
      userId: user.id,
      kind: "comment_on_pr",
      payload: PAYLOAD,
      excludeAgentRunId: second.id,
      proposedAfter: WINDOW_START,
    });

    expect(found?.status).toBe("proposed");
  });

  // The safety argument: within one run the model could otherwise propose
  // and immediately consume its own offer, which is the only shape that lets
  // it manufacture the user's consent.
  it("ignores an offer made during the same run", async () => {
    const user = await makeUser("samerun");
    const run = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });

    const found = await findApprovableAction({
      userId: user.id,
      kind: "comment_on_pr",
      payload: PAYLOAD,
      excludeAgentRunId: run.id,
      proposedAfter: WINDOW_START,
    });

    expect(found).toBeNull();
  });

  // An offer the user talked past is not consent to run it later. Without
  // this, a declined offer would sit `proposed` indefinitely and could be
  // matched by an unrelated identical call much later.
  it("ignores an offer older than the approval window", async () => {
    const user = await makeUser("stale");
    const first = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    const second = await makeRun(user.id, "turn-2");

    const found = await findApprovableAction({
      userId: user.id,
      kind: "comment_on_pr",
      payload: PAYLOAD,
      excludeAgentRunId: second.id,
      // The run above started at AT; this window opens after it.
      proposedAfter: new Date(AT.getTime() + 60_000),
    });

    expect(found).toBeNull();
  });

  // Approval attaches to the exact text the user was read, not to the action's
  // name — otherwise a re-request with different wording would post words
  // nobody agreed to.
  it("does not match when the payload differs", async () => {
    const user = await makeUser("payload");
    const first = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    const second = await makeRun(user.id, "turn-2");

    const found = await findApprovableAction({
      userId: user.id,
      kind: "comment_on_pr",
      payload: { ...PAYLOAD, body: "ship it" },
      excludeAgentRunId: second.id,
      proposedAfter: WINDOW_START,
    });

    expect(found).toBeNull();
  });

  it("does not match a different tool", async () => {
    const user = await makeUser("kind");
    const first = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    const second = await makeRun(user.id, "turn-2");

    expect(
      await findApprovableAction({
        userId: user.id,
        kind: "merge_pr",
        payload: PAYLOAD,
        excludeAgentRunId: second.id,

        proposedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });

  it("does not reach another user's offers", async () => {
    const user = await makeUser("owner2");
    const intruder = await makeUser("intruder2");
    const first = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    const other = await makeRun(intruder.id, "turn-2");

    expect(
      await findApprovableAction({
        userId: intruder.id,
        kind: "comment_on_pr",
        payload: PAYLOAD,
        excludeAgentRunId: other.id,

        proposedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });

  it("does not match an offer that already executed", async () => {
    const user = await makeUser("spent");
    const first = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: PAYLOAD,
    });
    await markActionExecuted({ id: action.id, externalRef: "https://github.com/x", at: AT });
    const second = await makeRun(user.id, "turn-2");

    expect(
      await findApprovableAction({
        userId: user.id,
        kind: "comment_on_pr",
        payload: PAYLOAD,
        excludeAgentRunId: second.id,

        proposedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });
});

describe("the Ledger", () => {
  it("shows an executed action with the link that proves it ran", async () => {
    const user = await makeUser("ledger");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "comment_on_pr",
      payload: { artifactId: "a1", body: "demo successful" },
    });

    await markActionExecuted({
      id: action.id,
      externalRef: "https://github.com/acme/repo/pull/82#issuecomment-1",
      at: AT,
    });

    const [entry] = await listActions(user.id);
    expect(entry.status).toBe("executed");
    expect(entry.externalRef).toBe("https://github.com/acme/repo/pull/82#issuecomment-1");
    expect(entry.executedAt).toEqual(AT);
  });

  it("records a failure as failed, not as something that happened", async () => {
    const user = await makeUser("failed");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "merge_pr",
      payload: { artifactId: "a1" },
    });

    await markActionFailed(action.id);

    const [entry] = await listActions(user.id);
    expect(entry.status).toBe("failed");
    expect(entry.executedAt).toBeNull();
  });
});
