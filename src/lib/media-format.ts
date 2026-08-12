// Safari's MediaRecorder emits audio/mp4 (AAC), not audio/webm;codecs=opus —
// design doc §9's iOS gotcha #2. Check isTypeSupported() and accept both.
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function pickAudioMimeType(isTypeSupported: (type: string) => boolean): string | undefined {
  return AUDIO_MIME_CANDIDATES.find(isTypeSupported);
}
