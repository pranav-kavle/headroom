import { describe, expect, it } from "vitest";
import { StubSttProvider } from "@/lib/stt";

describe("StubSttProvider", () => {
  it("returns a short prefix of the canned transcript for a small clip", async () => {
    const provider = new StubSttProvider();

    const { transcript } = await provider.transcribe(Buffer.alloc(100), "audio/webm");

    expect(transcript.split(" ").length).toBe(1);
  });

  it("returns more words as the clip grows", async () => {
    const provider = new StubSttProvider();

    const short = await provider.transcribe(Buffer.alloc(100), "audio/webm");
    const long = await provider.transcribe(Buffer.alloc(20_000), "audio/webm");

    expect(long.transcript.split(" ").length).toBeGreaterThan(short.transcript.split(" ").length);
  });

  it("caps at the full canned transcript for a very large clip", async () => {
    const provider = new StubSttProvider();

    const first = await provider.transcribe(Buffer.alloc(1_000_000), "audio/webm");
    const second = await provider.transcribe(Buffer.alloc(2_000_000), "audio/webm");

    expect(second.transcript).toBe(first.transcript);
  });
});
