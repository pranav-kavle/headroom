import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  closeTrackedPullRequestIfPresent,
  createProposedAction,
  findApprovableAction,
  findArtifactById,
  finishAgentRun,
  listCommitments,
  listRecentArtifactsBySource,
  markActionExecuted,
  markActionFailed,
  startAgentRun,
} from "@headroom/graph";
import { verifyThinkToken, type ThinkTokenClaims } from "@/lib/agent-think-auth";
import { resolveAnthropicApiKey } from "@/lib/agent";
import { runAgentTurn, type MessageCreator } from "@/lib/agent-loop";
import { getGithubAccessToken } from "@/lib/github-token";
import { getSlackCredentials } from "@/lib/slack-token";
import { recordTurn } from "@/lib/agent-turns";
import { captureUtterance } from "@/lib/capture";
import {
  isEchoOfPrecedingAgentTurn,
  latestUserTranscript,
  toChatCompletionStream,
  toTurnMessages,
  type ChatCompletionRequest,
} from "@/lib/openai-compat";

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

// How long an unanswered Tier 2 offer stays confirmable. Long enough to cover
// "hang on — yes, do it" inside one conversation, short enough that an offer
// the user talked past is not still live later on.
const APPROVAL_WINDOW_MS = 15 * 60 * 1000;

// The link that makes a Ledger entry checkable rather than just a claim that
// something ran. Each Tier 2 tool names its link differently — comment_on_pr
// returns `commentUrl`, close/merge return `url`, send_slack_message returns
// `permalink` — so they are read in one place instead of the Ledger silently
// showing no evidence for whichever tool was added last.
function externalRefOf(output: unknown): string | undefined {
  const result = output as { commentUrl?: unknown; url?: unknown; permalink?: unknown } | null;
  for (const candidate of [result?.commentUrl, result?.url, result?.permalink]) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return undefined;
}

// Deepgram Voice Agent's `think` step, wearing an OpenAI chat-completions mask
// — design doc 2026-08-12-deepgram-voice-agent-design.md §2/§5. Deepgram calls
// this directly with no browser session attached, so identity comes from the
// signed token the browser embedded in the Settings message's custom header,
// not from a Clerk cookie. Everything past that point is `runAgentTurn` — the
// hand-written loop in agent-loop.ts, which is where the tier gate and the
// output verifier live.
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let claims: ThinkTokenClaims;
  try {
    claims = verifyThinkToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  const { userId, clerkUserId, ...principal } = claims;

  const body = (await request.json()) as ChatCompletionRequest;
  const model = body.model ?? "headroom-agent";
  const transcript = latestUserTranscript(body);
  if (!transcript.trim()) {
    return new Response(toChatCompletionStream("", model), { headers: SSE_HEADERS });
  }

  // The agent's own voice bleeding back through the mic, transcribed as a real
  // turn. `voice-session.ts`'s mic gate is the primary defence; this is the
  // backstop Deepgram recommends for whatever still gets through. An empty
  // reply is the same "say nothing" path the blank-transcript case above takes,
  // so the agent stays silent instead of answering itself.
  if (isEchoOfPrecedingAgentTurn(body)) {
    console.info("[think] dropped a turn that echoed the agent's own previous reply");
    return new Response(toChatCompletionStream("", model), { headers: SSE_HEADERS });
  }

  const client = new Anthropic({ apiKey: resolveAnthropicApiKey() });

  // One instant for the whole turn: the engine's dates and the principal
  // block's resolved dates come from here, so they cannot disagree.
  const now = new Date();

  // 2026-08-13 spec §6. Started before the model call and awaited after it, so
  // the write hides entirely behind the model's latency. Placed after both
  // guards above deliberately — an echoed turn is the agent's own voice, and
  // storing it would attribute Otto's words to the user.
  const captured = captureUtterance({ userId, transcript, occurredAt: now });

  // The GitHub write tools (comment_on_pr/close_pr/merge_pr) need a live
  // token per turn. Resolved here, not inside the engine, per port rule 6 —
  // a failed Clerk lookup should not fail the whole turn, so the tools just
  // see no token and refuse with "GitHub is not connected" instead.
  let githubToken: string | undefined;
  if (clerkUserId) {
    try {
      githubToken = (await getGithubAccessToken(clerkUserId)) ?? undefined;
    } catch (error) {
      console.warn("[think] GitHub token lookup failed", error);
    }
  }

  // Slack's tools (check_slack/list_slack_channels/send_slack_message) need
  // the same. Keyed on the internal user id, not the Clerk one — Headroom
  // stores this token itself after its own OAuth callback, rather than reading
  // it back out of Clerk the way the GitHub one above is.
  let slackCredentials: { accessToken: string; slackUserId: string } | undefined;
  try {
    slackCredentials = (await getSlackCredentials(userId)) ?? undefined;
  } catch (error) {
    console.warn("[think] Slack token lookup failed", error);
  }

  // The turn's orchestration row. An Action can't exist without one, which is
  // why the Ledger was empty — so this is what makes an outward-facing action
  // recordable at all. A failure here must not cost the user their turn, so it
  // degrades to no approval path rather than a 500.
  const turnId = randomUUID();
  let agentRunId: string | undefined;
  try {
    agentRunId = (await startAgentRun({ userId, turnId, payload: { transcript }, at: now })).id;
  } catch (error) {
    console.error("[think] could not open an agent run — Tier 2 approvals unavailable this turn", error);
  }

  const result = await runAgentTurn({
    turnId,
    // Spec §5: the whole conversation, not just the latest line.
    messages: toTurnMessages(body),
    principal,
    client: client.messages as unknown as MessageCreator,
    context: {
      userId,
      // The engine owns `now` — core rule 1 means the model never resolves a
      // date itself, so it has to be handed one.
      now,
      // §4.2: a calendar day only exists relative to a zone, and this is the
      // user's own.
      timezone: principal.timezone ?? undefined,
      listCommitments: (id) => listCommitments(id),
      getArtifactById: (id) => findArtifactById(id, userId),
      markPullRequestClosed: (artifactId, state) =>
        closeTrackedPullRequestIfPresent({ artifactId, state, at: now }),
      // §8's one tap. First time a Tier 2 call arrives it is recorded as an
      // offer and refused; when the user comes back and it arrives again —
      // same tool, byte-identical arguments, a different run — that is the
      // confirmation, and it executes. Excluding this run is what stops the
      // model proposing and consuming its own offer inside one turn.
      resolveApproval: agentRunId
        ? async ({ tool, tier, payload }) => {
            const approvable = await findApprovableAction({
              userId,
              kind: tool,
              payload,
              excludeAgentRunId: agentRunId,
              proposedAfter: new Date(now.getTime() - APPROVAL_WINDOW_MS),
            });
            if (approvable) return { approved: true, actionId: approvable.id };

            await createProposedAction({ userId, agentRunId, tier, kind: tool, payload });
            return { approved: false };
          }
        : undefined,
      recordActionExecuted: async (actionId, output) => {
        await markActionExecuted({ id: actionId, externalRef: externalRefOf(output), at: new Date() });
      },
      recordActionFailed: (actionId) => markActionFailed(actionId).then(() => undefined),
      // §16's live lookups (get_weather/get_events/get_flight_status). If
      // unset, the tool itself throws a named "key not configured" error
      // rather than this route failing the whole turn up front.
      ticketmasterApiKey: process.env.TICKETMASTER_API_KEY,
      rapidApiKey: process.env.RAPIDAPI_KEY,
      githubToken,
      slackCredentials,
      // Slack messages never become commitments (2026-08-15 spec §1), so
      // `listCommitments` above cannot reach them and check_slack reads the
      // artifacts directly. Scoped to this user here, in the closure, for the
      // same reason getArtifactById is.
      listRecentSlackMessages: (_userId, limit) =>
        listRecentArtifactsBySource({ userId, source: "slack", limit }),
    },
  });

  const artifact = await captured;

  if (agentRunId) {
    await finishAgentRun({ id: agentRunId, status: "ok", at: new Date() }).catch((error) =>
      console.warn("[think] could not close the agent run", error),
    );
  }

  // 2026-08-13 spec §2. One record per turn, carrying everything that turn did
  // — what was spoken, what backs it, what ran, what the policy gate refused
  // to run, and anything the verifier caught. The browser reads it back by
  // matching on `text`.
  recordTurn({
    turnId: result.turnId,
    userId,
    text: result.text,
    citations: result.citations,
    toolCalls: result.toolCalls,
    blocked: result.blocked,
    violations: result.violations,
    totalMs: result.timings.totalMs,
    createdAt: now.toISOString(),
  });

  // A blocked action and a failed verification are the two things here worth
  // waking up to, so they are named rather than folded into a count.
  if (result.violations.length > 0) {
    console.error(
      `[think] turn=${result.turnId} spoken reply withheld — ${result.violations
        .map((v) => `${v.kind}: ${v.detail}`)
        .join("; ")}`,
    );
  }
  for (const block of result.blocked) {
    console.warn(`[think] turn=${result.turnId} blocked ${block.tool} (${block.tier}) — ${block.policy}`);
  }

  console.info(
    `[think] turn=${result.turnId} total=${result.timings.totalMs}ms turns=${result.timings.turns
      .map((t) => `${t.modelMs}/${t.toolMs}`)
      .join(" ")} tools=${result.toolCalls.join(",") || "none"} citations=${
      result.citations.length
    } artifact=${artifact?.id ?? "none"}`,
  );

  return new Response(toChatCompletionStream(result.text, model), { headers: SSE_HEADERS });
}
