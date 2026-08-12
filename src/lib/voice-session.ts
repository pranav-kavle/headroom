import {
  AgentMicrophone,
  AgentPlayer,
  AgentSession,
  type AgentSettingsObject,
  type ThinkSettings,
  type SpeakSettings,
} from "@deepgram/agents";
import { AgentTokenResponse } from "@headroom/contracts";

// Narrower than AgentSettingsObject's `think`/`speak` (each ThinkSettings |
// ThinkSettings[] there) — buildAgentSettings only ever builds one of each,
// so callers and tests can access `.provider`/`.endpoint` directly.
interface HeadroomAgentSettings extends Omit<AgentSettingsObject, "think" | "speak"> {
  think: ThinkSettings;
  speak: SpeakSettings;
}

// Design doc 2026-08-12-deepgram-voice-agent-design.md §5/§6. Port rule 5 —
// platform capabilities behind interfaces — VoiceRecorder.tsx only sees
// start()/stop() and the callbacks below; everything Deepgram-specific stays
// in this file, the same way MediaRecorder was already abstracted.
export interface VoiceSessionEvents {
  onConversationText?: (message: { role: string; content: string }) => void;
  onUserStartedSpeaking?: () => void;
  onAgentStartedSpeaking?: () => void;
  onError?: (error: Error) => void;
  onDisconnected?: () => void;
}

export interface VoiceSession {
  start(): Promise<void>;
  stop(): void;
}

interface CreateVoiceSessionOptions {
  // The absolute URL Deepgram's servers will call — a relative path won't
  // resolve from their side, so the caller (a browser component) supplies
  // it from `window.location.origin` rather than this module guessing.
  thinkEndpointUrl: string;
  fetchImpl?: typeof fetch;
}

// Deepgram's own listen/speak, our own think — §2's chosen architecture.
// `agent.think.functions` stays unset: Deepgram never sees a tool schema or a
// tool call, because every engine call happens inside /api/v1/agent/think
// before it returns finished text.
export function buildAgentSettings(options: {
  thinkEndpointUrl: string;
  thinkAuthToken: string;
}): HeadroomAgentSettings {
  return {
    listen: {
      provider: { type: "deepgram", version: "v2", model: "flux-general-en" },
    },
    think: {
      // `model` is required by the schema but ignored once `endpoint.url` is
      // set — §8's open question, left as a placeholder rather than a guess.
      provider: { type: "open_ai", model: "headroom-agent" },
      endpoint: {
        url: options.thinkEndpointUrl,
        headers: { Authorization: `Bearer ${options.thinkAuthToken}` },
      },
    },
    speak: {
      provider: { type: "deepgram", model: "aura-2-thalia-en" },
    },
  };
}

async function fetchAgentToken(fetchImpl: typeof fetch): Promise<AgentTokenResponse> {
  const response = await fetchImpl("/api/v1/voice/agent-token", { method: "POST" });
  if (!response.ok) {
    throw new Error("Could not start a voice session");
  }
  return AgentTokenResponse.parse(await response.json());
}

// One silent Int16 sample. AgentPlayer creates its AudioContext lazily, the
// first time `queue()` runs — which would otherwise be whenever the first
// agent-audio chunk arrives, well after any tap gesture. Design doc §9
// gotcha #1: iOS requires the context that will play audio to be created and
// resumed synchronously inside the gesture, so this call has to happen before
// createVoiceSession's first `await`, not after.
const SILENT_FRAME = new ArrayBuffer(2);

export async function createVoiceSession(
  events: VoiceSessionEvents,
  options: CreateVoiceSessionOptions,
): Promise<VoiceSession> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const player = new AgentPlayer();
  player.queue(SILENT_FRAME);

  const initialToken = await fetchAgentToken(fetchImpl);

  const session = new AgentSession({
    auth: { tokenFactory: async () => (await fetchAgentToken(fetchImpl)).deepgramAccessToken },
    agent: buildAgentSettings({
      thinkEndpointUrl: options.thinkEndpointUrl,
      thinkAuthToken: initialToken.thinkAuthToken,
    }),
  });

  const microphone = new AgentMicrophone((frame) => session.sendAudio(frame));

  session.on("audio", (chunk) => player.queue(chunk));
  session.on("user-started-speaking", () => {
    // AgentPlayer.interrupt() is the documented barge-in mechanism — Deepgram
    // does not truncate in-flight TTS server-side, per §8.
    player.interrupt();
    events.onUserStartedSpeaking?.();
  });
  session.on("agent-started-speaking", () => events.onAgentStartedSpeaking?.());
  session.on("conversation-text", (message) =>
    events.onConversationText?.({ role: message.role, content: message.content }),
  );
  session.on("error", (error) => events.onError?.(new Error(JSON.stringify(error))));
  session.on("sdk-error", (error) => events.onError?.(error));
  session.on("disconnected", () => events.onDisconnected?.());

  return {
    async start() {
      await session.connect();
      await microphone.start();
    },
    stop() {
      microphone.stop();
      player.dispose();
      session.disconnect();
    },
  };
}
