import {
  createArtifact,
  findArtifactBySourceExternalId,
  getConnectorCursor,
  resolvePerson,
  upsertConnectorCursor,
} from "@headroom/graph";
import { runIntegrationSync } from "../sync-run";
import {
  fetchSlackHistory,
  fetchSlackTeamDomain,
  fetchSlackUserName,
  listSlackConversations,
  type SlackMessage,
} from "./api";

export interface SlackSyncSummary {
  channelsScanned: number;
  messagesSynced: number;
}

// Slack messages can be long; artifacts hold an excerpt for provenance, not
// the full document.
const MAX_EXCERPT = 2000;

interface StoredCursor {
  channels: Record<string, string>;
}

function readStoredChannels(cursor: unknown): Record<string, string> {
  const channels = (cursor as StoredCursor | null | undefined)?.channels;
  return channels && typeof channels === "object" ? { ...channels } : {};
}

/**
 * A message's permalink, in the archives form Slack itself returns from
 * chat.getPermalink — the fractional seconds separator is dropped and the
 * whole thing prefixed with "p".
 */
function permalinkFor(domain: string, channelId: string, ts: string): string {
  return `https://${domain}.slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}

function isIngestable(message: SlackMessage): boolean {
  // Subtyped messages are joins, leaves, topic changes and pins — structural
  // noise that carries no commitment and would only dilute the eval set that
  // extraction gets built against later (2026-08-15 spec §1).
  return message.subtype === null && message.text.trim().length > 0;
}

export async function syncSlack(input: {
  userId: string;
  token: string;
  slackUserId: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<SlackSyncSummary> {
  return runIntegrationSync({ userId: input.userId, source: "slack", now: input.now }, async () => {
    const call = { token: input.token, fetchImpl: input.fetchImpl };

    const [domain, conversations, existingCursor] = await Promise.all([
      fetchSlackTeamDomain(call),
      listSlackConversations(call),
      getConnectorCursor(input.userId, "slack"),
    ]);

    // Seeded with the stored cursor rather than empty, so a channel with no
    // new messages this run keeps its resume point instead of rewinding to
    // the beginning of its history.
    const channels = readStoredChannels(existingCursor?.cursor);

    // One lookup per author per sync, not per message — users.info shares the
    // same rate limit budget as the history calls that matter.
    const personIdBySlackUser = new Map<string, string | undefined>();
    let messagesSynced = 0;

    for (const conversation of conversations) {
      const messages = await fetchSlackHistory({
        ...call,
        channelId: conversation.id,
        oldest: channels[conversation.id],
      });

      let newestTs = channels[conversation.id];

      for (const message of messages) {
        // Tracked before the ingestable check: skipping past join noise still
        // has to advance the cursor, or every sync refetches the same window.
        if (!newestTs || Number(message.ts) > Number(newestTs)) {
          newestTs = message.ts;
        }

        if (!isIngestable(message)) continue;

        const externalId = `${conversation.id}:${message.ts}`;
        const existing = await findArtifactBySourceExternalId(input.userId, "slack", externalId);
        if (existing) continue;

        let authorPersonId: string | undefined;
        if (message.user) {
          if (!personIdBySlackUser.has(message.user)) {
            const displayName = (await fetchSlackUserName({ ...call, userId: message.user })) ?? message.user;
            const person = await resolvePerson({
              userId: input.userId,
              kind: "slack",
              value: message.user,
              confidence: 1,
              displayName,
            });
            personIdBySlackUser.set(message.user, person.id);
          }
          authorPersonId = personIdBySlackUser.get(message.user);
        }

        await createArtifact({
          userId: input.userId,
          source: "slack",
          externalId,
          // Slack's ts is epoch seconds with microsecond precision.
          occurredAt: new Date(Number(message.ts) * 1000),
          excerpt: message.text.slice(0, MAX_EXCERPT),
          url: permalinkFor(domain, conversation.id, message.ts),
          authorPersonId,
        });
        messagesSynced += 1;
      }

      if (newestTs) channels[conversation.id] = newestTs;
    }

    await upsertConnectorCursor({
      userId: input.userId,
      source: "slack",
      status: "running",
      cursor: { channels },
    });

    return { channelsScanned: conversations.length, messagesSynced };
  });
}
