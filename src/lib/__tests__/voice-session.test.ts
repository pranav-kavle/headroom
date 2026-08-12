import { describe, expect, it, vi } from "vitest";
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
let lastMicFrameCallback: ((data: ArrayBuffer) => void) | undefined;

vi.mock("@deepgram/agents", () => ({
  AgentSession: vi.fn().mockImplementation(() => ({
    on: (event: string, handler: (...args: unknown[]) => void) => {
      sessionHandlers.set(event, handler);
    },
    connect,
    disconnect,
    sendAudio,
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
});
