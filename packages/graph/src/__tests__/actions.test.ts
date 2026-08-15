import { afterEach, describe, expect, it } from "vitest";
import {
  createProposedAction,
  createUser,
  findApprovableAction,
  findRecentlyExecutedAction,
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

// Every real run carries the words that opened it — findApprovableAction reads
// them back to tell a fresh confirmation from a duplicate request for the same
// utterance, so a run without one is not a run this code ever sees in prod.
const ASKED = "Can you comment on the PR?";
const CONFIRMED = "Yeah, go ahead.";

async function makeRun(userId: string, turnId: string, transcript = ASKED) {
  return startAgentRun({ userId, turnId, payload: { transcript }, at: AT });
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

  // The bug this pair exists for. "A different run" was taken to mean the user
  // had spoken again, and it does not: Deepgram sends /agent/think more than
  // one request for a single utterance, each opening its own run and making its
  // own identical tool call. The second matched the first's proposal and ran —
  // so "close PR 90" closed PR 90 on the asking turn, a second before the offer
  // was spoken. The user's "yeah" then arrived to find the PR already gone, and
  // the agent correctly reported it could not find it, which read as a failure.
  it("ignores a duplicate request carrying the same utterance", async () => {
    const user = await makeUser("dupe");
    const first = await makeRun(user.id, "turn-1", ASKED);
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "close_pr",
      payload: PAYLOAD,
    });
    // A second request for the *same* spoken words: a different run, a
    // different turn id, and not a confirmation of anything.
    const duplicate = await makeRun(user.id, "turn-1-duplicate", ASKED);

    const found = await findApprovableAction({
      userId: user.id,
      kind: "close_pr",
      payload: PAYLOAD,
      excludeAgentRunId: duplicate.id,
      utterance: ASKED,
      proposedAfter: WINDOW_START,
    });

    expect(found).toBeNull();
  });

  it("approves once the user has actually said something new", async () => {
    const user = await makeUser("spokeagain");
    const asking = await makeRun(user.id, "turn-1", ASKED);
    await createProposedAction({
      userId: user.id,
      agentRunId: asking.id,
      tier: "tier_2",
      kind: "close_pr",
      payload: PAYLOAD,
    });
    const confirming = await makeRun(user.id, "turn-2", CONFIRMED);

    const found = await findApprovableAction({
      userId: user.id,
      kind: "close_pr",
      payload: PAYLOAD,
      excludeAgentRunId: confirming.id,
      utterance: CONFIRMED,
      proposedAfter: WINDOW_START,
    });

    expect(found?.status).toBe("proposed");
  });

  // Fail closed. Without the words behind a proposal there is no way to tell a
  // confirmation from a duplicate, and the failure that matters is the one that
  // executes something nobody agreed to.
  it("refuses to approve against a proposal whose utterance was never recorded", async () => {
    const user = await makeUser("notranscript");
    const first = await startAgentRun({ userId: user.id, turnId: "turn-1", at: AT });
    await createProposedAction({
      userId: user.id,
      agentRunId: first.id,
      tier: "tier_2",
      kind: "close_pr",
      payload: PAYLOAD,
    });
    const second = await makeRun(user.id, "turn-2", CONFIRMED);

    const found = await findApprovableAction({
      userId: user.id,
      kind: "close_pr",
      payload: PAYLOAD,
      excludeAgentRunId: second.id,
      utterance: CONFIRMED,
      proposedAfter: WINDOW_START,
    });

    expect(found).toBeNull();
  });

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
      utterance: CONFIRMED,
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
      utterance: CONFIRMED,
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
      utterance: CONFIRMED,
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
      utterance: CONFIRMED,
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

        utterance: CONFIRMED,
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

        utterance: CONFIRMED,
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

        utterance: CONFIRMED,
      proposedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });
});

describe("findRecentlyExecutedAction", () => {
  const PAYLOAD = { channel: "C1", text: "We need to ramp up efficiency." };

  // The double send. Two requests for one "yep" each recorded a proposal; the
  // first executed and sent, the second left an offer nobody asked for, and the
  // user's next words matched it — so the message went out twice.
  it("reports a send that already happened", async () => {
    const user = await makeUser("done");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "send_slack_message",
      payload: PAYLOAD,
    });
    await markActionExecuted({ id: action.id, externalRef: "https://slack.com/p1", at: AT });

    const done = await findRecentlyExecutedAction({
      userId: user.id,
      kind: "send_slack_message",
      payload: PAYLOAD,
      executedAfter: WINDOW_START,
    });

    expect(done?.externalRef).toBe("https://slack.com/p1");
  });

  it("does not report an offer that never ran", async () => {
    const user = await makeUser("notdone");
    const run = await makeRun(user.id, "turn-1");
    await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "send_slack_message",
      payload: PAYLOAD,
    });

    expect(
      await findRecentlyExecutedAction({
        userId: user.id,
        kind: "send_slack_message",
        payload: PAYLOAD,
        executedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });

  // Different words are a different message, and must send.
  it("does not report a different payload as done", async () => {
    const user = await makeUser("donepayload");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "send_slack_message",
      payload: PAYLOAD,
    });
    await markActionExecuted({ id: action.id, at: AT });

    expect(
      await findRecentlyExecutedAction({
        userId: user.id,
        kind: "send_slack_message",
        payload: { ...PAYLOAD, text: "Something else." },
        executedAfter: WINDOW_START,
      }),
    ).toBeNull();
  });

  // Past the window, asking again is a new request rather than a repeat.
  it("does not report a send from outside the window", async () => {
    const user = await makeUser("doneold");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "send_slack_message",
      payload: PAYLOAD,
    });
    await markActionExecuted({ id: action.id, at: AT });

    expect(
      await findRecentlyExecutedAction({
        userId: user.id,
        kind: "send_slack_message",
        payload: PAYLOAD,
        executedAfter: new Date(AT.getTime() + 60_000),
      }),
    ).toBeNull();
  });

  it("does not reach another user's completed actions", async () => {
    const user = await makeUser("doneowner");
    const intruder = await makeUser("doneintruder");
    const run = await makeRun(user.id, "turn-1");
    const action = await createProposedAction({
      userId: user.id,
      agentRunId: run.id,
      tier: "tier_2",
      kind: "send_slack_message",
      payload: PAYLOAD,
    });
    await markActionExecuted({ id: action.id, at: AT });

    expect(
      await findRecentlyExecutedAction({
        userId: intruder.id,
        kind: "send_slack_message",
        payload: PAYLOAD,
        executedAfter: WINDOW_START,
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
