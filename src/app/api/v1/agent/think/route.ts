import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listCommitments } from "@headroom/graph";
import { verifyThinkToken, type ThinkTokenClaims } from "@/lib/agent-think-auth";
import { resolveAnthropicApiKey } from "@/lib/agent";
import { runAgentTurn, type MessageCreator } from "@/lib/agent-loop";
import { recordCitations } from "@/lib/agent-think-citations";
import { captureUtterance } from "@/lib/capture";
import {
  isEchoOfPrecedingAgentTurn,
  latestUserTranscript,
  toChatCompletionStream,
  toTurnMessages,
  type ChatCompletionRequest,
} from "@/lib/openai-compat";

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

// Deepgram Voice Agent's `think` step, wearing an OpenAI chat-completions mask
// — design doc 2026-08-12-deepgram-voice-agent-design.md §2/§5. Deepgram calls
// this directly with no browser session attached, so identity comes from the
// signed token the browser embedded in the Settings message's custom header,
// not from a Clerk cookie. Everything past that point is the same Tool Runner
// /api/v1/agent/turns used to run — same model, same tier-gating hook.
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
  const { userId, ...principal } = claims;

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

  const result = await runAgentTurn({
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
      // §16's live lookups (get_weather/get_events/get_flight_status). If
      // unset, the tool itself throws a named "key not configured" error
      // rather than this route failing the whole turn up front.
      ticketmasterApiKey: process.env.TICKETMASTER_API_KEY,
      rapidApiKey: process.env.RAPIDAPI_KEY,
    },
  });

  recordCitations(userId, result.citations);

  const artifact = await captured;

  console.info(
    `[think] total=${result.timings.totalMs}ms turns=${result.timings.turns
      .map((t) => `${t.modelMs}/${t.toolMs}`)
      .join(" ")} citations=${result.citations.length} artifact=${artifact?.id ?? "none"}`,
  );

  return new Response(toChatCompletionStream(result.text, model), { headers: SSE_HEADERS });
}
