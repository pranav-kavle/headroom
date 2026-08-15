// Slack's engine tools — design doc §7/§8/§16, 2026-08-15 spec §4/§5.
//
// Slack differs from every other source here in one way that shapes all three
// tools: extraction is deliberately out of scope (spec §1), so a Slack message
// never becomes a Commitment. `get_state` reads commitments, so it is
// structurally blind to Slack no matter how much has synced. `check_slack`
// therefore has to hand back the messages themselves, or the model has a
// connected workspace it cannot say one word about.
//
// That makes provenance the whole design. Each message goes back with its
// artifact id, the author's name, the time, the text as a quote, and a
// permalink — core rule 2's requirement stated exactly, so a reply about
// Slack traces to a stored Artifact the same way a commitment does.

import { listSlackSendTargets, sendSlackMessage, syncSlack, type SlackSendTarget } from "@headroom/integrations";
import type { EngineContext, EngineTool } from ".";

// Enough for "what came in today", small enough that a chatty workspace can't
// crowd the turn out of its token budget. The engine picks it, not the model:
// a model-supplied limit is a number the model chose, and core rule 1 keeps
// counts on this side of the line.
const RECENT_MESSAGE_LIMIT = 25;

// Structural, not Prisma's row type — the same reason StateCommitmentInput is
// (port rule 6). The engine names the shape it needs; the app layer satisfies it.
export interface SlackMessageArtifact {
  id: string;
  occurredAt: Date;
  excerpt: string;
  url: string | null;
  authorPerson: { displayName: string } | null;
}

interface SlackMessageSummary {
  artifactId: string;
  author: string | null;
  occurredAt: string;
  quote: string;
  url: string | null;
}

function requireSlackCredentials(context: EngineContext): { accessToken: string; slackUserId: string } {
  if (!context.slackCredentials) {
    throw new Error("Slack is not connected for this user.");
  }
  return context.slackCredentials;
}

function requireString(input: Record<string, unknown>, key: string, toolName: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${toolName} requires a ${key}.`);
  }
  return value;
}

function toSummary(artifact: SlackMessageArtifact): SlackMessageSummary {
  return {
    artifactId: artifact.id,
    author: artifact.authorPerson?.displayName ?? null,
    // ISO, like every other date the engine hands over: the model reads these
    // back as words, and never does arithmetic on them.
    occurredAt: artifact.occurredAt.toISOString(),
    quote: artifact.excerpt,
    url: artifact.url,
  };
}

export const slackTools: EngineTool[] = [
  {
    name: "check_slack",
    description:
      "Triggers a fresh Slack sync and returns the most recent messages from the user's channels and DMs, each with who wrote it, when, the text itself, and a link. Call this whenever the user asks about Slack, about what someone said, or about anything they might have been asked for in a message. Slack messages arrive constantly and you were not trained on today's, so never answer this from memory. Quote the text as given and attribute it to the named author; do not summarise a message as a commitment, since these are not tracked commitments and get_state does not include them.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    external: true,
    aboutUser: true,
    handler: async (_input, context) => {
      const { accessToken, slackUserId } = requireSlackCredentials(context);
      const summary = await syncSlack({
        userId: context.userId,
        token: accessToken,
        // Which messages are the user's own — the sync cannot attribute
        // anything without it.
        slackUserId,
        now: context.now,
        fetchImpl: context.fetchImpl,
      });

      // Read after the sync, so the messages this returns include the ones it
      // just wrote. Optional like every other graph accessor — a context
      // without one still reports the sync rather than failing the turn.
      const artifacts = context.listRecentSlackMessages
        ? await context.listRecentSlackMessages(context.userId, RECENT_MESSAGE_LIMIT)
        : [];

      return { ...summary, recentMessages: artifacts.map(toSummary) };
    },
  },
  {
    name: "list_slack_channels",
    description:
      "Lists the Slack channels and direct messages the user can send to, with each one's id and name. Call this whenever the user asks you to send a Slack message, so the recipient is chosen from real conversations rather than guessed — send_slack_message needs an id from here. Channel and DM membership changes and you were not trained on today's, so never answer this from memory.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    external: true,
    handler: async (_input, context): Promise<{ channels: SlackSendTarget[] }> => {
      const { accessToken } = requireSlackCredentials(context);
      return {
        channels: await listSlackSendTargets({ token: accessToken, fetchImpl: context.fetchImpl }),
      };
    },
  },
  {
    name: "send_slack_message",
    // §8 Tier 2: outward-facing, one tap, always. Both the channel and the
    // text are fixed here at approval time — the tap approves this exact
    // payload, never a template filled in afterwards (spec §5).
    description:
      "Send a Slack message to a channel or direct message. The channel must be an id from list_slack_channels — never one you have inferred. It needs the user's approval, and calling it is how you ask: the first call comes back needing approval — offer it then, reading back the channel and the exact text, and do not claim it is sent. When they confirm, call again with identical arguments and it sends.",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: "The conversation's id, taken from list_slack_channels.",
        },
        text: { type: "string", description: "Exactly what to send." },
      },
      required: ["channel", "text"],
      additionalProperties: false,
    },
    external: true,
    tier: "tier_2",
    handler: async (input, context) => {
      const channel = requireString(input, "channel", "send_slack_message");
      const text = requireString(input, "text", "send_slack_message");
      const { accessToken } = requireSlackCredentials(context);
      return sendSlackMessage({ token: accessToken, channel, text, fetchImpl: context.fetchImpl });
    },
  },
];
