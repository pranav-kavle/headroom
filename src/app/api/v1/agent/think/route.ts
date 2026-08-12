import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listCommitments } from "@headroom/graph";
import { verifyThinkToken } from "@/lib/agent-think-auth";
import { resolveAnthropicApiKey } from "@/lib/agent";
import { runAgentTurn, type MessageCreator } from "@/lib/agent-loop";
import { recordCitations } from "@/lib/agent-think-citations";
import { latestUserTranscript, toChatCompletionResponse, type ChatCompletionRequest } from "@/lib/openai-compat";

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

  let userId: string;
  try {
    userId = verifyThinkToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const body = (await request.json()) as ChatCompletionRequest;
  const model = body.model ?? "headroom-agent";
  const transcript = latestUserTranscript(body);
  if (!transcript.trim()) {
    return NextResponse.json(toChatCompletionResponse("", model));
  }

  const client = new Anthropic({ apiKey: resolveAnthropicApiKey() });

  const result = await runAgentTurn({
    transcript,
    client: client.messages as unknown as MessageCreator,
    context: {
      userId,
      // The engine owns `now` — core rule 1 means the model never resolves a
      // date itself, so it has to be handed one.
      now: new Date(),
      listCommitments: (id) => listCommitments(id),
    },
  });

  recordCitations(userId, result.citations);

  console.info(
    `[think] total=${result.timings.totalMs}ms turns=${result.timings.turns
      .map((t) => `${t.modelMs}/${t.toolMs}`)
      .join(" ")} citations=${result.citations.length}`,
  );

  return NextResponse.json(toChatCompletionResponse(result.text, model));
}
