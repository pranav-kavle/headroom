// Slack as a source integration — 2026-08-15 spec §4. Raw fetch against the
// Slack Web API, matching the no-SDK convention used by the GitHub and Google
// Health connectors.
//
// Two Slack-specific hazards this module exists to contain:
//   1. Slack signals most failures with HTTP 200 and {ok:false}. Checking
//      response.ok alone silently yields undefined fields downstream.
//   2. conversations.history is Tier 3 (~50 req/min). A 429 carries a
//      Retry-After header that has to be honoured or the sync dies partway.

export interface SlackConversation {
  id: string;
  name: string | null;
  isIm: boolean;
  // The other party, on a DM only. A DM has no `name` at all, so this is the
  // only handle a caller has for labelling one with a person instead of an
  // opaque channel id.
  userId: string | null;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user: string | null;
  subtype: string | null;
}

// Every conversation type the granted scopes can read. Dropping `im`/`mpim`
// here would compile and pass a smoke test while quietly discarding the
// highest-value source.
const CONVERSATION_TYPES = "public_channel,private_channel,im,mpim";

const PAGE_LIMIT = 200;
const MAX_RATE_LIMIT_RETRIES = 3;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface SlackCallOptions {
  token: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

interface SlackEnvelope {
  ok?: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
}

/**
 * One Slack Web API call, form-encoded with a Bearer token, retrying on 429
 * for as long as Slack keeps saying Retry-After — bounded, so a persistently
 * throttled workspace fails loudly instead of hanging the sync.
 */
async function callSlack<T extends SlackEnvelope>(
  method: string,
  params: Record<string, string>,
  options: SlackCallOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetchImpl(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 1);
      await sleepImpl((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000);
      continue;
    }

    const json = (await response.json()) as T;
    if (!json.ok) {
      throw new Error(`Slack ${method} failed: ${json.error ?? response.statusText}`);
    }
    return json;
  }

  throw new Error(`Slack ${method} failed: rate limited after ${MAX_RATE_LIMIT_RETRIES} retries`);
}

export async function listSlackConversations(options: SlackCallOptions): Promise<SlackConversation[]> {
  const conversations: SlackConversation[] = [];
  let cursor = "";

  do {
    const params: Record<string, string> = {
      types: CONVERSATION_TYPES,
      exclude_archived: "true",
      limit: String(PAGE_LIMIT),
    };
    if (cursor) params.cursor = cursor;

    const json = await callSlack<SlackEnvelope & { channels?: Array<Record<string, unknown>> }>(
      "users.conversations",
      params,
      options,
    );

    for (const channel of json.channels ?? []) {
      if (typeof channel.id !== "string") continue;
      conversations.push({
        id: channel.id,
        name: typeof channel.name === "string" ? channel.name : null,
        isIm: channel.is_im === true,
        userId: typeof channel.user === "string" ? channel.user : null,
      });
    }

    cursor = json.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return conversations;
}

export async function fetchSlackHistory(
  input: SlackCallOptions & { channelId: string; oldest?: string },
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor = "";

  do {
    const params: Record<string, string> = { channel: input.channelId, limit: String(PAGE_LIMIT) };
    // Slack treats `oldest` as exclusive, so the stored cursor ts is never
    // re-ingested on the next run.
    if (input.oldest) params.oldest = input.oldest;
    if (cursor) params.cursor = cursor;

    const json = await callSlack<SlackEnvelope & { messages?: Array<Record<string, unknown>> }>(
      "conversations.history",
      params,
      input,
    );

    for (const message of json.messages ?? []) {
      if (typeof message.ts !== "string") continue;
      messages.push({
        ts: message.ts,
        text: typeof message.text === "string" ? message.text : "",
        user: typeof message.user === "string" ? message.user : null,
        subtype: typeof message.subtype === "string" ? message.subtype : null,
      });
    }

    cursor = json.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return messages;
}

/**
 * The workspace subdomain, used to build message permalinks.
 *
 * Fetched once per sync rather than per message. The alternative — calling
 * chat.getPermalink for every message — is one API call each against a ~50/min
 * limit, and constructing the URL from a teamId instead of the domain does not
 * produce a working archives link. One call per sync buys provenance links
 * that actually resolve, which design doc §3 rule 2 requires.
 */
export async function fetchSlackTeamDomain(options: SlackCallOptions): Promise<string> {
  const json = await callSlack<SlackEnvelope & { team?: { domain?: string } }>("team.info", {}, options);
  const domain = json.team?.domain;
  if (!domain) {
    throw new Error("Slack team.info returned no domain — message permalinks cannot be built.");
  }
  return domain;
}

/**
 * Best-effort display name for an author. Returns null rather than throwing:
 * a deactivated or out-of-workspace author is not a reason to fail a sync
 * that has already fetched real messages.
 */
export async function fetchSlackUserName(
  input: SlackCallOptions & { userId: string },
): Promise<string | null> {
  try {
    const json = await callSlack<SlackEnvelope & { user?: { real_name?: string; name?: string } }>(
      "users.info",
      { user: input.userId },
      input,
    );
    return json.user?.real_name ?? json.user?.name ?? null;
  } catch {
    return null;
  }
}

export async function postSlackMessage(
  input: SlackCallOptions & { channel: string; text: string },
): Promise<{ ts: string; channel: string }> {
  const json = await callSlack<SlackEnvelope & { ts?: string; channel?: string }>(
    "chat.postMessage",
    { channel: input.channel, text: input.text },
    input,
  );
  return { ts: json.ts ?? "", channel: json.channel ?? input.channel };
}
