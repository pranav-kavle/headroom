import { describe, expect, it } from "vitest";
import { latestUserTranscript, toChatCompletionResponse } from "../openai-compat";

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

describe("toChatCompletionResponse", () => {
  it("wraps the reply as an assistant message an OpenAI client can parse", () => {
    const response = toChatCompletionResponse("You owe Maya the deck.", "headroom-agent");

    expect(response.object).toBe("chat.completion");
    expect(response.model).toBe("headroom-agent");
    expect(response.choices).toEqual([
      {
        index: 0,
        message: { role: "assistant", content: "You owe Maya the deck." },
        finish_reason: "stop",
      },
    ]);
  });
});
