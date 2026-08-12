// Speech-to-text behind an interface — design doc §11 port rule 5. Swap
// StubSttProvider for a real Deepgram/Groq-backed implementation once a
// provider is chosen; every caller depends only on SttProvider.
export interface SttProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<{ transcript: string }>;
}

const STUB_TRANSCRIPT =
  "this is a stub transcript standing in for real speech to text";
const BYTES_PER_WORD = 4_000;

export class StubSttProvider implements SttProvider {
  async transcribe(audio: Buffer): Promise<{ transcript: string }> {
    const words = STUB_TRANSCRIPT.split(" ");
    const wordCount = Math.min(words.length, Math.max(1, Math.floor(audio.length / BYTES_PER_WORD) + 1));
    return { transcript: words.slice(0, wordCount).join(" ") };
  }
}
