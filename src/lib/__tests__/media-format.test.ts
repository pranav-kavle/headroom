import { describe, expect, it } from "vitest";
import { pickAudioMimeType } from "@/lib/media-format";

describe("pickAudioMimeType", () => {
  it("prefers webm+opus over mp4 when both are supported", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/mp4"]);

    expect(pickAudioMimeType((type) => supported.has(type))).toBe("audio/webm;codecs=opus");
  });

  it("falls back to mp4 on Safari, which only supports that one", () => {
    const supported = new Set(["audio/mp4"]);

    expect(pickAudioMimeType((type) => supported.has(type))).toBe("audio/mp4");
  });

  it("returns undefined when nothing is supported", () => {
    expect(pickAudioMimeType(() => false)).toBeUndefined();
  });
});
