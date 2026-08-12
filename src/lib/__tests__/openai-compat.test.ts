import { describe, expect, it } from "vitest";
import { latestUserTranscript, toChatCompletionStream } from "../openai-compat";

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

describe("latestUserTranscript", () => {
  it("returns the most recent user message's content", () => {
    const transcript = latestUserTranscript({
      messages: [
        { role: "system", content: "You are Headroom." },
        { role: "user", content: "what do I owe?" },
        { role: "assistant", content: "Nothing on file." },
        { role: "user", content: "and Maya?" },
      ],
    });

    expect(transcript).toBe("and Maya?");
  });

  it("returns an empty string when there is no user message", () => {
    const transcript = latestUserTranscript({
      messages: [{ role: "system", content: "You are Headroom." }],
    });

    expect(transcript).toBe("");
  });
});

// Deepgram's custom `think` endpoint requires SSE, not a single JSON body —
// confirmed live: a plain JSON response let /api/v1/agent/think run and
// return real text every time (per the container logs), but Deepgram never
// spoke it, because it can't parse a response that isn't chunked this way.
describe("toChatCompletionStream", () => {
  it("streams the reply as OpenAI-shaped SSE chunks ending in [DONE]", async () => {
    const body = await readAll(toChatCompletionStream("You owe Maya the deck.", "headroom-agent"));
    const events = body.trim().split("\n\n").filter(Boolean);

    const contentChunk = JSON.parse(events[0].replace(/^data: /, ""));
    expect(contentChunk.object).toBe("chat.completion.chunk");
    expect(contentChunk.model).toBe("headroom-agent");
    expect(contentChunk.choices[0].delta).toEqual({
      role: "assistant",
      content: "You owe Maya the deck.",
    });

    const finalChunk = JSON.parse(events[1].replace(/^data: /, ""));
    expect(finalChunk.choices[0].delta).toEqual({});
    expect(finalChunk.choices[0].finish_reason).toBe("stop");

    expect(events[2]).toBe("data: [DONE]");
  });

  it("still streams a valid (empty) reply when there's nothing to say", async () => {
    const body = await readAll(toChatCompletionStream("", "headroom-agent"));

    expect(body).toContain("data: [DONE]");
  });
});
