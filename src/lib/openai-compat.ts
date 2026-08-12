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

export function toChatCompletionResponse(text: string, model: string) {
  return {
    id: `chatcmpl-${randomUUID()}`,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content: text },
        finish_reason: "stop" as const,
      },
    ],
  };
}
