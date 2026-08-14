import { randomUUID } from "node:crypto";

// The mask /api/v1/agent/think wears for Deepgram's `agent.think` custom
// endpoint — design doc 2026-08-12-deepgram-voice-agent-design.md §2/§5.
// Deepgram only accepts a custom think provider that speaks the OpenAI
// chat-completions wire format; everything on our side of this file is our
// own Tool Runner, untouched.
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
}

export function latestUserTranscript(request: ChatCompletionRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i--) {
    const message = request.messages[i];
    if (message.role === "user") return message.content;
  }
  return "";
}

// Below this, an utterance is left alone: "yes", "the deck", "go ahead" are
// ordinary replies that trivially appear inside the agent's own last turn, and
// an echo that short can't carry enough content to send the agent off on a
// self-sustaining tangent anyway.
const ECHO_MIN_WORDS = 4;

function normalizeForEchoCompare(text: string): string {
  return (
    text
      .toLowerCase()
      // Apostrophes are dropped rather than spaced out, so the TTS text's
      // "I'll" still matches whatever the transcriber wrote it back as —
      // spacing it would split the contraction into "i ll" and never match.
      .replace(/['‘’]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Deepgram's recommended software-level echo defence, and the only one that
// holds regardless of acoustics: compare the STT output against the TTS text
// the agent just spoke and discard on a match. `voice-session.ts`'s mic gate is
// the primary fix — this is the backstop for what a speakerphone, a reflective
// room, or an AEC that hasn't converged yet still lets through.
//
// Containment rather than equality, because the mic typically catches only part
// of the agent's sentence: the transcript is a slice of the reply, not a copy.
export function isEchoOfPrecedingAgentTurn(request: ChatCompletionRequest): boolean {
  const messages = request.messages;

  let userIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userIndex = i;
      break;
    }
  }
  if (userIndex < 0) return false;

  // Only the agent turn directly before this one counts. An intervening user
  // turn means the user has spoken since, so a later match is them quoting the
  // agent back rather than the speaker bleeding into the mic.
  let spokenByAgent: string | undefined;
  for (let i = userIndex - 1; i >= 0; i--) {
    if (messages[i].role === "user") break;
    if (messages[i].role === "assistant") {
      spokenByAgent = messages[i].content;
      break;
    }
  }
  if (!spokenByAgent) return false;

  const heard = normalizeForEchoCompare(messages[userIndex].content);
  if (heard.split(" ").filter(Boolean).length < ECHO_MIN_WORDS) return false;

  return normalizeForEchoCompare(spokenByAgent).includes(heard);
}

// Deepgram's custom `think` endpoint requires this exact SSE shape — a plain
// JSON chat-completion body runs fine but is never spoken, confirmed live via
// the container logs (real text returned every time, nothing ever reached
// speech). Not real token streaming: our own Tool Runner only has the full
// reply once its two-turn loop finishes, so this sends it as a single delta
// chunk followed by the closing chunk and `[DONE]`, matching the framing
// Deepgram's parser expects without pretending to stream token-by-token.
export function toChatCompletionStream(text: string, model: string): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  const contentChunk = {
    id,
    object: "chat.completion.chunk" as const,
    created,
    model,
    choices: [{ index: 0, delta: { role: "assistant" as const, content: text }, finish_reason: null }],
  };
  const finalChunk = {
    id,
    object: "chat.completion.chunk" as const,
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" as const }],
  };

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
