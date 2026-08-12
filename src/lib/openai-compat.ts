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
