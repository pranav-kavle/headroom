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
// eot_threshold/eot_timeout_ms are documented Flux settings (Deepgram's
// Configure Voice Agent docs) but aren't in @deepgram/agents 0.1.1's published
// V2 listen-provider type yet — assigned through this pre-typed constant
// rather than an inline literal so TS's excess-property check doesn't reject
// them structurally. Not yet verified against a live agent socket.
const LISTEN_PROVIDER = {
  type: "deepgram" as const,
  version: "v2" as const,
  model: "flux-general-en",
  // Above Deepgram's defaults (0.7 / 5000ms) — richer asks ("what's the
  // weather, and is my flight on time") mean more mid-sentence pauses, so a
  // little extra patience here beats cutting the user off. eot_timeout_ms is
  // deliberately short of the full patience budget (bug 8): a plain 7000ms
  // made every utterance, including a short "hey", wait as long as a
  // genuinely ambiguous one before the model was even called.
  eot_threshold: 0.8,
  eot_timeout_ms: 5800,
};

export function buildAgentSettings(options: {
  thinkEndpointUrl: string;
  thinkAuthToken: string;
}): HeadroomAgentSettings {
  return {
    listen: {
      provider: LISTEN_PROVIDER,
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

// @deepgram/agents' injectAgentMessage() only exists on the client-held
// AgentSession — there is no session-id-keyed side channel a server route
// could use, so /api/v1/agent/think (which is what actually knows a slow
// tool is running) can never trigger this directly. A latency-based timer is
// the only mechanism available from here: fast calls (get_state,
// get_action_policy) resolve well inside this window and never see a filler;
// the three live third-party lookups (get_weather/get_events/
// get_flight_status) are the ones slow enough to cross it.
const FILLER_DELAY_MS = 1200;
const FILLER_MESSAGE = "Let me check that.";

// AgentSession only tells Deepgram what rate to actually use if `audio.*` is
// explicitly set — omit it and Deepgram picks its own default while
// AgentMicrophone/AgentPlayer still assume 16kHz in / 24kHz out, decoding
// every chunk at the wrong rate regardless of what that default turns out to
// be. Pinning both sides to the same constants removes the ambiguity outright
// rather than relying on defaults matching by coincidence.
const MIC_SAMPLE_RATE = 16_000;
const SPEAK_SAMPLE_RATE = 24_000;

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

  // Temporary tracing for bugs 1/2: self-echo was reported as still live in
  // roughly the first 10s of a session despite the mic-gating fix below
  // looking correct on review. Rather than guess a second time, this traces
  // the actual event/timing sequence — in particular, whether
  // user-started-speaking ever fires while micGated is already true, which
  // should be impossible if gating is doing its job and would point at
  // something bypassing it entirely. Remove once the root cause is found.
  const sessionStartedAt = Date.now();
  const trace = (event: string, extra?: Record<string, unknown>) => {
    console.debug(`[voice +${Date.now() - sessionStartedAt}ms] ${event}`, extra ?? "");
  };

  const player = new AgentPlayer({ sampleRate: SPEAK_SAMPLE_RATE });
  player.queue(SILENT_FRAME);

  const initialToken = await fetchAgentToken(fetchImpl);

  const session = new AgentSession({
    auth: { tokenFactory: async () => (await fetchAgentToken(fetchImpl)).deepgramAccessToken },
    agent: buildAgentSettings({
      thinkEndpointUrl: options.thinkEndpointUrl,
      thinkAuthToken: initialToken.thinkAuthToken,
    }),
    audio: {
      input: { encoding: "linear16", sampleRate: MIC_SAMPLE_RATE },
      output: { encoding: "linear16", sampleRate: SPEAK_SAMPLE_RATE },
    },
  });

  // Bugs 1/2: the mic stays open for the whole session (barge-in, above), but
  // AgentPlayer plays TTS through a raw Web Audio destination rather than an
  // <audio> element, and browser echo-cancellation isn't reliable for that —
  // the agent's own voice can get picked back up as if the user were
  // talking, both cutting its own reply off early (via the barge-in
  // interrupt below) and getting transcribed as a real turn. Dropping
  // outgoing frames while the agent's audio is actually playing removes the
  // self-echo source; the trade-off is that true voice barge-in no longer
  // works — tap-to-end is still available while the agent is speaking.
  let micGated = false;
  const microphone = new AgentMicrophone(
    (frame) => {
      if (!micGated) session.sendAudio(frame);
    },
    { sampleRate: MIC_SAMPLE_RATE },
  );

  let fillerTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelFiller = () => {
    clearTimeout(fillerTimer);
    fillerTimer = undefined;
  };

  // agent-audio-done fires once the *server* has finished sending audio
  // bytes for the reply — AgentPlayer schedules those bytes for real-time
  // playback separately, so for anything longer than a short reply there's a
  // real window where the transport signal has already fired but the reply
  // is still audibly playing. Poll actual remaining playback time rather
  // than trusting the transport-level event alone.
  const PLAYBACK_POLL_INTERVAL_MS = 100;
  let playbackPollTimer: ReturnType<typeof setInterval> | undefined;
  const stopPlaybackPoll = () => {
    clearInterval(playbackPollTimer);
    playbackPollTimer = undefined;
  };

  session.on("welcome", () => trace("welcome"));
  session.on("settings-applied", () => trace("settings-applied"));
  session.on("audio", (chunk) => player.queue(chunk));
  session.on("user-started-speaking", () => {
    // The money line for the bugs 1/2 investigation: this should be
    // impossible to see with micGated: true. If it shows up anyway,
    // something is sending Deepgram audio outside our own gated frame
    // callback below.
    trace("user-started-speaking", { micGated });
    // AgentPlayer.interrupt() is the documented barge-in mechanism — Deepgram
    // does not truncate in-flight TTS server-side, per §8.
    player.interrupt();
    cancelFiller();
    events.onUserStartedSpeaking?.();
  });
  session.on("agent-thinking", () => {
    cancelFiller();
    fillerTimer = setTimeout(() => session.injectAgentMessage(FILLER_MESSAGE), FILLER_DELAY_MS);
  });
  session.on("agent-started-speaking", () => {
    trace("agent-started-speaking", { micGatedBefore: micGated });
    cancelFiller();
    stopPlaybackPoll();
    micGated = true;
    events.onAgentStartedSpeaking?.();
  });
  session.on("agent-audio-done", () => {
    trace("agent-audio-done", { remainingPlaybackTime: player.getRemainingPlaybackTime() });
    stopPlaybackPoll();
    const checkPlaybackFinished = () => {
      if (player.getRemainingPlaybackTime() <= 0) {
        micGated = false;
        trace("mic-ungated");
        stopPlaybackPoll();
      }
    };
    checkPlaybackFinished();
    if (micGated) {
      playbackPollTimer = setInterval(checkPlaybackFinished, PLAYBACK_POLL_INTERVAL_MS);
    }
  });
  session.on("conversation-text", (message) =>
    events.onConversationText?.({ role: message.role, content: message.content }),
  );
  session.on("error", (error) => events.onError?.(new Error(JSON.stringify(error))));
  session.on("sdk-error", (error) => events.onError?.(error));
  session.on("disconnected", () => events.onDisconnected?.());

  return {
    async start() {
      trace("connect:start");
      await session.connect();
      // connect() resolves once the socket is open, not once settings are
      // confirmed — mic capture below can begin before settings-applied,
      // which is worth seeing relative to the settings-applied trace above.
      trace("connect:resolved (socket open, settings not necessarily applied yet)");
      await microphone.start();
      trace("microphone:started");
    },
    stop() {
      cancelFiller();
      stopPlaybackPoll();
      microphone.stop();
      player.dispose();
      session.disconnect();
    },
  };
}
