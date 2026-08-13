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

  it("interrupts playback the moment the user starts speaking, enabling barge-in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deepgramAccessToken: "dg-jwt", deepgramExpiresInSeconds: 30, thinkAuthToken: "t" }),
      ),
    );
    const onUserStartedSpeaking = vi.fn();

    await createVoiceSession({ onUserStartedSpeaking }, { fetchImpl, thinkEndpointUrl: "https://app.example.com/api/v1/agent/think" });
    sessionHandlers.get("user-started-speaking")?.();

    expect(playerInterrupt).toHaveBeenCalled();
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

    it("resumes forwarding microphone frames once the agent's audio finishes", async () => {
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
      const frame = new ArrayBuffer(4);
      lastMicFrameCallback?.(frame);

      expect(sendAudio).toHaveBeenCalledWith(frame);
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
