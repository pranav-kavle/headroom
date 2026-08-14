import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentMicrophone, AgentPlayer, AgentSession } from "@deepgram/agents";
import { buildAgentSettings, createVoiceSession } from "../voice-session";

describe("buildAgentSettings", () => {
  it("points the think provider's custom endpoint at our own route with the signed token", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    expect(settings.think).toMatchObject({
      provider: { type: "open_ai" },
      endpoint: {
        url: "https://app.example.com/api/v1/agent/think",
        headers: { Authorization: "Bearer signed-token" },
      },
    });
  });

  it("leaves agent.think.functions unset — every engine call happens inside our endpoint", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    expect(settings.think.functions).toBeUndefined();
  });

  it("uses Deepgram's own listen and speak providers", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    expect(settings.listen?.provider).toMatchObject({ type: "deepgram" });
    expect(settings.speak?.provider).toMatchObject({ type: "deepgram" });
  });

  // Richer asks ("what's the weather, and is my flight on time") mean more
  // mid-sentence pauses. Biasing end-of-turn detection toward patience over
  // Deepgram's defaults (eot_threshold 0.7, eot_timeout_ms 5000) trades a
  // little latency for not cutting the user off mid-thought.
  it("biases end-of-turn detection toward patience rather than Deepgram's defaults", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    const provider = settings.listen?.provider as { eot_threshold?: number; eot_timeout_ms?: number };
    expect(provider.eot_threshold).toBeGreaterThan(0.7);
    expect(provider.eot_timeout_ms).toBeGreaterThan(5000);
  });

  // Bug 8: the full 7000ms timeout above made every utterance — including a
  // short, unambiguous "hey" — wait as long as a genuinely ambiguous
  // mid-sentence pause before /api/v1/agent/think is even called. Capping
  // the timeout well under that keeps most of the patience for long asks
  // without stalling a greeting for seconds.
  it("keeps the end-of-turn timeout well short of its full patience budget, so short utterances aren't held for seconds", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    const provider = settings.listen?.provider as { eot_timeout_ms?: number };
    expect(provider.eot_timeout_ms).toBeLessThanOrEqual(6000);
  });

  // Browser AEC is adaptive — it learns the speaker-to-mic acoustic path only
  // once audio is actually flowing, and leaks badly until it converges. That
  // convergence window is precisely the "first five or six turns" the self-echo
  // loop was seeded in. Deepgram's own guidance: an opening greeting lets the
  // AEC calibrate before the user's first reply.
  it("opens with a greeting, so browser echo cancellation converges before the first user turn", () => {
    const settings = buildAgentSettings({
      thinkEndpointUrl: "https://app.example.com/api/v1/agent/think",
      thinkAuthToken: "signed-token",
    });

    expect(settings.greeting).toEqual(expect.any(String));
    expect(settings.greeting?.length ?? 0).toBeGreaterThan(0);
  });
});

const sessionHandlers = new Map<string, (...args: unknown[]) => void>();
const sendAudio = vi.fn();
const connect = vi.fn().mockResolvedValue(undefined);
const disconnect = vi.fn();
const micStart = vi.fn().mockResolvedValue(undefined);
const micStop = vi.fn();
const playerQueue = vi.fn();
const playerInterrupt = vi.fn();
const playerDispose = vi.fn();
const injectAgentMessage = vi.fn();
// Defaults to "nothing left to play" so tests that don't care about playback
// timing (e.g. the plain agent-audio-done resume test) see the mic un-gate
// immediately, matching their pre-existing expectations.
const playerGetRemainingPlaybackTime = vi.fn().mockReturnValue(0);
let lastMicFrameCallback: ((data: ArrayBuffer) => void) | undefined;

vi.mock("@deepgram/agents", () => ({
  AgentSession: vi.fn().mockImplementation(() => ({
    on: (event: string, handler: (...args: unknown[]) => void) => {
      sessionHandlers.set(event, handler);
    },
    connect,
    disconnect,
    sendAudio,
    injectAgentMessage,
  })),
  AgentMicrophone: vi.fn().mockImplementation((onAudioFrame: (data: ArrayBuffer) => void) => {
    lastMicFrameCallback = onAudioFrame;
    return { start: micStart, stop: micStop };
  }),
  AgentPlayer: vi.fn().mockImplementation(() => ({
    queue: playerQueue,
    interrupt: playerInterrupt,
    dispose: playerDispose,
    getRemainingPlaybackTime: playerGetRemainingPlaybackTime,
  })),
}));

describe("createVoiceSession", () => {
  it("primes the player's audio context synchronously, inside the caller's gesture — §9 gotcha #1", () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );

    // Deliberately not awaited: AgentPlayer's AudioContext must be created
    // and resumed before the first `await` inside createVoiceSession, or the
    // network round trip for the token breaks the gesture-context link and
    // iOS silently refuses playback later.
    void createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });

    expect(playerQueue).toHaveBeenCalled();
  });

  it("forwards captured microphone frames to the Deepgram session", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          deepgramAccessToken: "dg-jwt",
          deepgramExpiresInSeconds: 30,
          thinkAuthToken: "signed-token",
        }),
      ),
    );

    const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    await session.start();

    const frame = new ArrayBuffer(4);
    lastMicFrameCallback?.(frame);

    expect(sendAudio).toHaveBeenCalledWith(frame);
    expect(connect).toHaveBeenCalled();
    expect(micStart).toHaveBeenCalled();
  });

  it("queues incoming agent audio on the player", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );

    await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    const chunk = new ArrayBuffer(8);
    sessionHandlers.get("audio")?.(chunk);

    expect(playerQueue).toHaveBeenCalledWith(chunk);
  });

  // Half-duplex, deliberately. player.interrupt() closes and nulls AgentPlayer's
  // AudioContext, which makes getRemainingPlaybackTime() report 0 no matter
  // what is actually playing — and Deepgram does not truncate in-flight TTS
  // server-side (§8), so the rest of the turn keeps streaming in and
  // _ensureContext() rebuilds a fresh context to play it. Calling interrupt()
  // on a self-echo-triggered UserStartedSpeaking is what turned a small echo
  // leak into a sustained loop: the gate opened against a lying playback clock
  // while the agent was still audibly speaking.
  it("does not interrupt playback on user-started-speaking — barge-in is traded away for a gate that can't lie", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );
    const onUserStartedSpeaking = vi.fn();

    await createVoiceSession({ onUserStartedSpeaking }, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    sessionHandlers.get("user-started-speaking")?.();

    expect(playerInterrupt).not.toHaveBeenCalled();
    expect(onUserStartedSpeaking).toHaveBeenCalled();
  });

  it("forwards conversation text to the caller's callback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );
    const onConversationText = vi.fn();

    await createVoiceSession({ onConversationText }, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    sessionHandlers.get("conversation-text")?.({ role: "assistant", content: "You owe Maya the deck." });

    expect(onConversationText).toHaveBeenCalledWith({ role: "assistant", content: "You owe Maya the deck." });
  });

  it("pins mic input and TTS output to the same sample rate on both sides, so playback isn't decoded at the wrong rate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );

    await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });

    // AgentSession only tells Deepgram what output rate to actually use if
    // `audio.output` is explicitly set — otherwise Deepgram picks its own
    // default while AgentPlayer still assumes 24kHz, decoding every chunk at
    // the wrong rate. Pinning both sides removes the ambiguity outright.
    const sessionConfig = vi.mocked(AgentSession).mock.calls.at(-1)?.[0];
    expect(sessionConfig?.audio).toEqual({
      input: { encoding: "linear16", sampleRate: 16000 },
      output: { encoding: "linear16", sampleRate: 24000 },
    });

    const micOptions = vi.mocked(AgentMicrophone).mock.calls.at(-1)?.[1];
    expect(micOptions?.sampleRate).toBe(16000);

    const playerOptions = vi.mocked(AgentPlayer).mock.calls.at(-1)?.[0];
    expect(playerOptions?.sampleRate).toBe(24000);
  });

  it("stops the microphone, disposes the player, and disconnects on stop()", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );

    const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    session.stop();

    expect(micStop).toHaveBeenCalled();
    expect(playerDispose).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  // Bugs 1/2: the mic stays open continuously (§6, barge-in), but AgentPlayer
  // plays TTS through a raw Web Audio destination rather than an <audio>
  // element, and browser echo-cancellation isn't reliable for that setup —
  // the agent's own voice can get picked back up, misread as the user
  // talking, and both cut playback off early (player.interrupt()) and get
  // transcribed as a real turn. Gating outgoing mic frames while the agent's
  // TTS is actually playing removes the self-echo source outright, at the
  // cost of true voice barge-in.
  describe("muting the microphone while the agent is speaking (echo prevention)", () => {
    it("stops forwarding microphone frames once the agent starts speaking", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
      await session.start();
      sendAudio.mockClear();

      sessionHandlers.get("agent-started-speaking")?.();
      lastMicFrameCallback?.(new ArrayBuffer(4));

      expect(sendAudio).not.toHaveBeenCalled();
    });

    // The gate has to survive audio that arrives *after* the events meant to
    // bracket a turn. Deepgram doesn't truncate in-flight TTS server-side, and
    // AgentPlayer.queue() silently rebuilds a closed AudioContext, so a stray
    // chunk after agent-audio-done is audible speech with no
    // agent-started-speaking to re-arm the gate. Any agent audio at all must
    // close it — this is the exact hole the self-echo loop came through.
    it("re-gates the mic when agent audio arrives after agent-audio-done", async () => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
          ),
        );

        const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
        await session.start();

        // A full turn drains and the mic legitimately reopens.
        sessionHandlers.get("agent-started-speaking")?.();
        sessionHandlers.get("agent-audio-done")?.();
        await vi.advanceTimersByTimeAsync(2000);
        sendAudio.mockClear();

        // Now a late chunk for that same turn shows up and starts playing.
        playerGetRemainingPlaybackTime.mockReturnValue(1.5);
        sessionHandlers.get("audio")?.(new ArrayBuffer(8));
        lastMicFrameCallback?.(new ArrayBuffer(4));

        expect(sendAudio).not.toHaveBeenCalled();
      } finally {
        playerGetRemainingPlaybackTime.mockReturnValue(0);
        vi.useRealTimers();
      }
    });

    // AudioContext.currentTime excludes the OS/hardware output buffer, and the
    // room's acoustic tail outlives the last sample regardless. Reopening the
    // mic the instant getRemainingPlaybackTime() hits 0 lets the end of the
    // agent's own last word back in.
    it("waits out a hangover after playback drains before reopening the mic", async () => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
          ),
        );

        const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
        await session.start();
        sendAudio.mockClear();

        sessionHandlers.get("agent-started-speaking")?.();
        sessionHandlers.get("agent-audio-done")?.();

        // Player reports drained, but the hangover hasn't elapsed yet.
        await vi.advanceTimersByTimeAsync(150);
        lastMicFrameCallback?.(new ArrayBuffer(4));
        expect(sendAudio).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(500);
        const frame = new ArrayBuffer(4);
        lastMicFrameCallback?.(frame);
        expect(sendAudio).toHaveBeenCalledWith(frame);
      } finally {
        vi.useRealTimers();
      }
    });

    // agent-audio-done means the *server* has finished sending audio bytes —
    // AgentPlayer schedules chunks for real-time playback separately, so for
    // anything longer than a short reply there's a real window where that
    // event has already fired but the agent is still audibly speaking.
    // Un-gating on the transport signal alone re-opens the mic mid-reply.
    it("stays gated past agent-audio-done while AgentPlayer still has queued audio to play", async () => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
          ),
        );

        const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
        await session.start();
        sendAudio.mockClear();

        playerGetRemainingPlaybackTime.mockReturnValue(2);
        sessionHandlers.get("agent-started-speaking")?.();
        sessionHandlers.get("agent-audio-done")?.();
        lastMicFrameCallback?.(new ArrayBuffer(4));

        expect(sendAudio).not.toHaveBeenCalled();

        playerGetRemainingPlaybackTime.mockReturnValue(0);
        await vi.advanceTimersByTimeAsync(500);
        const frame = new ArrayBuffer(4);
        lastMicFrameCallback?.(frame);

        expect(sendAudio).toHaveBeenCalledWith(frame);
      } finally {
        playerGetRemainingPlaybackTime.mockReturnValue(0);
        vi.useRealTimers();
      }
    });

    // Deepgram's audio-preprocessing guidance is explicit: keep platform AEC
    // on (it has direct access to both mic and speaker, so time alignment is
    // free) but turn noise suppression off, since aggressive NS degrades
    // transcription. AGC is off because at session start, with a quiet room,
    // it ramps input gain up and amplifies exactly the residual echo the AEC
    // hasn't converged on yet — the first seconds this bug lives in. The SDK
    // defaults all three to true.
    it("requests platform echo cancellation without noise suppression or automatic gain", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });

      const micOptions = vi.mocked(AgentMicrophone).mock.calls.at(-1)?.[1];
      expect(micOptions).toMatchObject({
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      });
    });
  });

  // The think endpoint's slow calls (get_weather/get_events/get_flight_status)
  // are the ones worth filling silence for, but injectAgentMessage only exists
  // as a call on the client-held session — the server has no way to trigger
  // it mid-request. A latency-based timer client-side is the only mechanism
  // that reaches the slow case without the client knowing which tool ran.
  describe("filler message while the agent is thinking", () => {
    afterEach(() => {
      vi.useRealTimers();
      injectAgentMessage.mockClear();
    });

    it("injects a filler if the agent hasn't started speaking within the filler delay", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
      sessionHandlers.get("agent-thinking")?.();
      vi.advanceTimersByTime(1200);

      expect(injectAgentMessage).toHaveBeenCalledTimes(1);
      expect(injectAgentMessage).toHaveBeenCalledWith(expect.any(String));
    });

    it("does not inject a filler once the agent starts speaking before the delay elapses", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
      sessionHandlers.get("agent-thinking")?.();
      sessionHandlers.get("agent-started-speaking")?.();
      vi.advanceTimersByTime(1200);

      expect(injectAgentMessage).not.toHaveBeenCalled();
    });

    it("cancels a pending filler if the user barges in before it fires", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
      sessionHandlers.get("agent-thinking")?.();
      sessionHandlers.get("user-started-speaking")?.();
      vi.advanceTimersByTime(1200);

      expect(injectAgentMessage).not.toHaveBeenCalled();
    });

    it("cancels a pending filler on stop() rather than firing after teardown", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
        ),
      );

      const session = await createVoiceSession({}, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
      sessionHandlers.get("agent-thinking")?.();
      session.stop();
      vi.advanceTimersByTime(1200);

      expect(injectAgentMessage).not.toHaveBeenCalled();
    });
  });
});
