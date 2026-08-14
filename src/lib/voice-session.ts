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
  // A documented Settings field (AgentSession's own reconnect path clears
  // `agent.greeting`), but absent from @deepgram/agents 0.1.1's published
  // types — declared here so it survives the wire without a cast.
  greeting?: string;
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

// Spoken the moment the session opens, before the user says anything. The
// point is acoustic, not conversational: browser AEC is an adaptive filter that
// only learns the speaker-to-mic path once audio is actually flowing, and leaks
// badly until it converges. That convergence window is exactly the first few
// turns the self-echo loop used to be seeded in, so giving the AEC a known
// signal to calibrate against up front closes it — Deepgram's audio
// preprocessing guide recommends precisely this.
const GREETING = "Hey — I'm here. What's on your mind?";

export function buildAgentSettings(options: {
  thinkEndpointUrl: string;
  thinkAuthToken: string;
}): HeadroomAgentSettings {
  return {
    greeting: GREETING,
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

  // Half-duplex: no mic audio leaves this client while the agent is audible.
  // AgentPlayer plays TTS through a raw Web Audio destination rather than an
  // <audio> element, so the agent's own voice can be picked back up, misread as
  // the user talking, and transcribed as a real turn — the agent then answers
  // itself, and the reply seeds the next round. Barge-in is the price; tap-to-
  // end still works while the agent is speaking.
  let micGated = false;
  const microphone = new AgentMicrophone(
    (frame) => {
      if (!micGated) session.sendAudio(frame);
    },
    {
      sampleRate: MIC_SAMPLE_RATE,
      // Platform AEC has direct access to both the mic and the speaker, so it
      // handles time alignment for free — the first and most effective layer.
      echoCancellation: true,
      // Both default to true in the SDK, and both work against us. Aggressive
      // noise suppression degrades transcription accuracy (Deepgram's own
      // guidance is to leave it off), and automatic gain ramps input gain up in
      // a quiet room at session start — amplifying exactly the residual echo
      // the AEC hasn't converged on yet.
      noiseSuppression: false,
      autoGainControl: false,
    },
  );

  let fillerTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelFiller = () => {
    clearTimeout(fillerTimer);
    fillerTimer = undefined;
  };

  // agent-audio-done fires once the *server* has finished sending audio bytes,
  // but AgentPlayer schedules those bytes for real-time playback separately —
  // so the transport signal leads the actual sound by the whole length of the
  // reply. Poll what's really left to play instead of trusting the event.
  //
  // The hangover sits on top of that, covering two things the playback clock
  // can't see: AudioContext.currentTime excludes the OS/hardware output buffer
  // (tens of ms wired, ~300ms over Bluetooth), and the room's acoustic tail
  // outlives the last sample either way. Reopening the mic the instant
  // getRemainingPlaybackTime() hits zero lets the end of the agent's own last
  // word straight back in.
  const PLAYBACK_POLL_INTERVAL_MS = 100;
  const MIC_UNGATE_HANGOVER_MS = 300;

  let playbackPollTimer: ReturnType<typeof setInterval> | undefined;
  let ungateTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelUngate = () => {
    clearInterval(playbackPollTimer);
    playbackPollTimer = undefined;
    clearTimeout(ungateTimer);
    ungateTimer = undefined;
  };

  // Any agent audio at all closes the gate and restarts the countdown to
  // reopening it. Bracketing on agent-started-speaking/agent-audio-done alone
  // was the hole the self-echo loop came through: Deepgram does not truncate
  // in-flight TTS server-side (§8), and AgentPlayer.queue() silently rebuilds a
  // closed AudioContext, so audio for a turn can arrive — and play out loud —
  // with no further event left to re-arm the gate. Driving the gate off the
  // audio itself means it cannot be left open while something is playing.
  const gateMicWhileAgentSpeaks = () => {
    micGated = true;

    // More audio has arrived, so any reopen already counting down is stale.
    clearTimeout(ungateTimer);
    ungateTimer = undefined;

    // Called once per audio chunk, so don't churn the interval — if the drain
    // watch is already running it stays valid.
    if (playbackPollTimer) return;

    const reopenWhenDrained = () => {
      if (player.getRemainingPlaybackTime() > 0) return;
      clearInterval(playbackPollTimer);
      playbackPollTimer = undefined;
      ungateTimer = setTimeout(() => {
        micGated = false;
        ungateTimer = undefined;
      }, MIC_UNGATE_HANGOVER_MS);
    };

    playbackPollTimer = setInterval(reopenWhenDrained, PLAYBACK_POLL_INTERVAL_MS);
    reopenWhenDrained();
  };

  session.on("audio", (chunk) => {
    gateMicWhileAgentSpeaks();
    player.queue(chunk);
  });
  session.on("user-started-speaking", () => {
    // Deliberately no player.interrupt() here. It closes and nulls
    // AgentPlayer's AudioContext, which makes getRemainingPlaybackTime() report
    // 0 no matter what is actually playing — the gate would then reopen against
    // a clock that is lying to it, mid-reply, which is what let a small echo
    // leak escalate into a sustained loop. Half-duplex means this event should
    // only fire while the agent is silent anyway.
    cancelFiller();
    events.onUserStartedSpeaking?.();
  });
  session.on("agent-thinking", () => {
    cancelFiller();
    fillerTimer = setTimeout(() => session.injectAgentMessage(FILLER_MESSAGE), FILLER_DELAY_MS);
  });
  session.on("agent-started-speaking", () => {
    cancelFiller();
    gateMicWhileAgentSpeaks();
    events.onAgentStartedSpeaking?.();
  });
  // No agent-audio-done handler by design — it's the transport's opinion about
  // a turn being over, and acting on it is what this bug was made of. The gate
  // above reopens itself once the player is genuinely drained.
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
      cancelFiller();
      cancelUngate();
      microphone.stop();
      player.dispose();
      session.disconnect();
    },
  };
}
