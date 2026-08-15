// Slack write action — design doc §8, Tier 2 ("outward-facing... one tap,
// always"), and 2026-08-15 spec §5.
//
// This is an *arbitrary* send: any channel or DM, not restricted to replying
// in the thread a commitment came from. That makes it the one action shape
// where a recipient is chosen rather than derived from an Artifact, so the
// binding matters — both `channel` and `text` are fixed at approval time and
// this function only ever receives an already-resolved payload. It never runs
// itself; getActionPolicy() decides that, and Tier 2 is deliberately not
// togglable, so enabling Tier 1 autonomy later does not unlock it.

import { fetchSlackTeamDomain, fetchSlackUserName, listSlackConversations, postSlackMessage } from "./api";

export const SLACK_SEND_TIER = "tier_2" as const;

// One users.info call per DM, so this bounds how much a single lookup can
// spend against Slack's rate limit. Well above a personal workspace's real
// conversation count, and far below the point where a reply would be unusable.
export const SLACK_TARGET_LIMIT = 100;

export interface SlackSendTarget {
  id: string;
  // A channel's own name, or the other person's on a DM. Null when Slack has
  // neither — the target is still reachable by id, so it stays in the list.
  name: string | null;
  isIm: boolean;
}

/**
 * Every channel and DM the user can send to, labelled well enough to choose
 * between them.
 *
 * The names are the point. `users.conversations` returns DMs with a user id
 * and no name, and a caller picking a send target from a list of raw channel
 * ids is picking blind — which for an outward-facing Tier 2 action means
 * approving a message to a recipient nobody can read off the approval.
 */
export async function listSlackSendTargets(input: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<SlackSendTarget[]> {
  const call = { token: input.token, fetchImpl: input.fetchImpl };
  const conversations = (await listSlackConversations(call)).slice(0, SLACK_TARGET_LIMIT);

  return Promise.all(
    conversations.map(async (conversation) => ({
      id: conversation.id,
      // fetchSlackUserName is already best-effort and returns null rather than
      // throwing, so one deactivated account cannot empty the whole list.
      name:
        conversation.isIm && conversation.userId
          ? await fetchSlackUserName({ ...call, userId: conversation.userId })
          : conversation.name,
      isIm: conversation.isIm,
    })),
  );
}

export interface SentSlackMessage {
  ts: string;
  channel: string;
  permalink: string | null;
}

export async function sendSlackMessage(input: {
  token: string;
  channel: string;
  text: string;
  fetchImpl?: typeof fetch;
}): Promise<SentSlackMessage> {
  if (!input.channel.trim()) {
    throw new Error("Slack send needs an explicit channel — the target is never inferred at send time.");
  }
  if (!input.text.trim()) {
    throw new Error("Slack send needs non-empty text.");
  }

  const call = { token: input.token, fetchImpl: input.fetchImpl };
  const sent = await postSlackMessage({ ...call, channel: input.channel, text: input.text });

  // Best-effort provenance link. The message is already out by this point, so
  // a failure here must not be reported as a failed send.
  let permalink: string | null = null;
  try {
    const domain = await fetchSlackTeamDomain(call);
    permalink = `https://${domain}.slack.com/archives/${sent.channel}/p${sent.ts.replace(".", "")}`;
  } catch {
    permalink = null;
  }

  return { ts: sent.ts, channel: sent.channel, permalink };
}
