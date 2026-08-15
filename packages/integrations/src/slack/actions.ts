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

import { fetchSlackTeamDomain, postSlackMessage } from "./api";

export const SLACK_SEND_TIER = "tier_2" as const;

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
