# Replacing the voice harness with Deepgram's Voice Agent

Supersedes parts of `docs/superpowers/specs/2026-08-12-voice-agent-harness-design.md`
(the "harness" doc) — specifically its §5 latency plan and the `stt.ts`/`tts.ts`/
`VoiceRecorder.tsx`/speech-route pieces of §6. Amends
`docs/superpowers/specs/2026-08-11-headroom-commitments-design.md` §9's "push-to-talk
only" decision. Everything else in both docs — the Tool Runner choice (§2), MCP as an
internal boundary (§3), the two honest day-one behaviours (§4), core rule 4 itself — is
retained and re-argued below rather than changed.

## 1. Why

The harness doc built push-to-talk: hold a button, release, wait through
transcribe → think → speak, press again for the next turn. Two things about that
don't hold up once you actually want to talk to this thing: the round trip is slow
(batch STT, two Claude turns, batch TTS, all sequential), and there's no way to
interrupt — the mic is only ever hot while a finger is on the button, never while the
agent is talking back. Both come from the same root cause: three separate HTTP hops
instead of one continuous audio session with real turn-taking.

Deepgram's Voice Agent API is a managed real-time session that owns exactly the part
that's hard to build well — turn detection, barge-in, streaming audio in both
directions — over a single WebSocket. The question this doc answers is how to adopt
that without handing away what the harness doc was careful to protect: the engine
computing every figure, and a single enforcement point deciding whether a tool call is
allowed to run.

## 2. What was rejected, and why

**Deepgram's managed "think" step (point `agent.think.provider` at Anthropic
directly).** Rejected. Deepgram's Anthropic integration exposes `model` and
`temperature` — nothing else. No extended thinking, no effort, no forced tool choice.
The harness doc's §5 specifically flagged that disabling Opus's thinking lets it write
a tool call into visible text instead of a real one — the turn succeeds, the tool never
runs, and nothing errors. That's not a hypothetical here; it's the documented failure
mode this exact model exhibits, and Deepgram's managed integration has no knob to
prevent it. Handing the LLM call to Deepgram means losing the one lever that keeps core
rule 1 (the engine computes) from failing silently.

**Deepgram's raw streaming STT + TTS sockets, with our own turn-taking on top.**
Rejected. This gets the latency win without the barge-in win — we'd still have to build
endpointing, interruption detection, and playback cancellation ourselves, which is
exactly the hard part Deepgram's product exists to solve. Worth doing only if the
option below turned out to be unavailable.

**Chosen: Deepgram Voice Agent for the audio session; our own endpoint for `think`.**
Deepgram's `agent.think.provider` accepts a custom endpoint — but only if it speaks the
OpenAI chat-completions wire format, and that endpoint is a plain HTTPS POST, not
another socket. That means the Tool Runner already built in `agent.ts` — Opus 5,
`effort`, thinking left on, `cache_control`, the tier-gating hook — can sit behind a
thin OpenAI-shaped mask and keep doing exactly what it does today. Deepgram never sees
a tool call; it sees an LLM that eventually returns finished text. All the tool-calling
happens inside our endpoint, invisible to Deepgram, exactly as invisible to it as it is
today to the client.

## 3. Core rule 4, checked explicitly

Core rule 4 says voice is STT → text → engine → TTS, never speech-to-speech, because a
speech-to-speech model can speak a number nothing computed and leave nothing to audit.
This design keeps that pipeline intact — Deepgram's STT produces text, that text is the
only thing that reaches our endpoint, our endpoint's only output is text, and that text
is the only thing Deepgram speaks. What changes is who operates the STT and TTS legs
(Deepgram's session instead of our batch calls) and that those legs now run
concurrently with a live conversation instead of once per button press. No audio ever
reaches the model; no text the engine didn't produce or the user didn't say is ever
spoken. The rule holds in substance, not just in the three-hop shape it was written
against.

## 4. Architecture

```
   tap "start"
        │
        ▼
 POST /api/v1/voice/agent-token  ──►  Deepgram auth grant  ──►  30s JWT
        │
        ▼
 browser opens wss://agent.deepgram.com/v1/agent/converse
   (token on Sec-WebSocket-Protocol — browsers can't set
   a custom Authorization header on a WS handshake)
        │
        ├─ mic audio streams up continuously for the whole session
        │
        ▼
 Deepgram: listen (STT) → think → speak (TTS)
                    │
                    ▼
      POST /api/v1/agent/think   (OpenAI chat-completions shape)
                    │
                    ▼
      agent.ts Tool Runner — Opus 5, effort, thinking on,
      cache_control, tier-gating hook, MCP engine tools
                    │
                    ▼
      finished text back to Deepgram, unchanged shape
                    │
                    ▼
      Deepgram speaks it; audio streams down the same socket
                    │
                    ▼
      user can start talking any time — UserStartedSpeaking
      fires whether or not the agent is mid-sentence
```

`packages/engine-mcp` is untouched: it's still an in-process port, still never on the
network, per the harness doc's §3. The only new network boundary is the token-minting
route and the `think` endpoint, both plain stateless POSTs — port rule 1 holds for
everything except the audio socket itself, which is a third-party platform capability
in the same sense `MediaRecorder` already was under port rule 5, not a protocol we
designed.

## 5. Components

**`src/app/api/v1/voice/agent-token/route.ts`** — new. `POST`, no body. Calls
Deepgram's token grant endpoint server-side with the real API key and returns the
short-lived JWT. The real key never reaches the browser. Called by the client before
every connect and reconnect, per Deepgram's own token-factory pattern — tokens are
30 seconds, so a stale one is useless to anyone who captures it off the wire.

**`src/app/api/v1/agent/think/route.ts`** — replaces `src/app/api/v1/agent/turns/route.ts`.
`POST`, request/response in OpenAI chat-completions shape (`messages`, optional
`tools`; response a `choices[0].message`). Internally: translate the incoming messages
into the same Tool Runner call `agent.ts` already makes, run it exactly as today
(system prompt, engine tools, tier-gating hook, cache placement), translate the result
back to OpenAI shape. `agent.ts` itself is otherwise unchanged — same model, same
`effort`, same tools. `agent.think.functions` in the Settings message sent to Deepgram
stays empty — Deepgram never sees a tool schema or a tool call; every engine call
happens inside this route before it returns finished text.

**`src/lib/stt.ts`, `src/lib/tts.ts`, `src/app/api/v1/voice/transcriptions/route.ts`,
`src/app/api/v1/voice/speech/route.ts`** — deleted. Deepgram's session now owns both
legs; there's no batch STT call and no separate speech-synthesis call left to make.

**`src/lib/voice-session.ts`** — new. Port rule 5's `VoiceSession` abstraction: wraps
`@deepgram/agents`'s `AgentSession`/`AgentMicrophone`/`AgentPlayer` behind `start()`/
`stop()` and a handful of callbacks, so `VoiceRecorder.tsx` never touches Deepgram's SDK
directly — the same shape `MediaRecorder` was already abstracted behind. Also where
§9 gotcha #1 resurfaces: `AgentPlayer` creates its `AudioContext` lazily, on the first
`queue()` call, which would otherwise be whenever the first agent-audio chunk arrives —
long after the tap. Fixed by priming it (`queue()` on a silent frame) synchronously,
before this module's first `await`, so it still runs inside the caller's gesture.

**`src/app/api/v1/agent/think/citations/route.ts`** — new. `GET`, returns and clears the
citations most recently recorded by `/api/v1/agent/think` for the signed-in user. Needed
because citations are produced inside `agent/think` and never reach Deepgram — there's no
field in the OpenAI-shaped response Deepgram forwards to the browser — so the client
polls this side channel right after each assistant `conversation-text` event instead.

**`src/components/voice/VoiceRecorder.tsx`** — rewritten. Tap to start: mint a token,
open the WebSocket via `voice-session.ts`, stream mic audio continuously for the
session's duration. Tap to end: close the socket, release the mic. Renders a running log
of turn entries rather than one transcript+reply pair per press, since a session is many
turns; each assistant entry's citations arrive slightly after the entry itself, from the
citations route above. On `UserStartedSpeaking`, calls `AgentPlayer.interrupt()` to flush
queued audio immediately — confirmed via the SDK's source as the documented client-side
barge-in mechanism (§8 resolves what was an open question here).

**`src/lib/timing.ts`** — kept, per-leg latency logging still matters; the legs it
measures change (session-open, first-token-from-think, first-audio-byte) but the
instrumentation instinct from the harness doc's §5 carries over unchanged.

## 6. Interaction model change

Push-to-talk becomes tap-to-start / tap-to-end, because barge-in requires the mic open
while the agent is speaking, which a press-and-hold gesture can't express. This is a
deliberate, scoped reversal of the commitments design doc §9's "push-to-talk only, no
wake word, no always-listening" — the mic is still never open outside an explicit
session (start and end are both explicit taps, nothing ambient), but within a session
it stays open continuously rather than only while held. §9's other constraints are
unaffected: still no wake word, still no background audio once a session ends, and
"voice carries the narrative, the screen carries the evidence" still governs — citations
render per turn in the running log, not just on the last one.

## 7. Pricing

Deepgram: **Custom – BYO LLM** tier, since `think` points at our own endpoint —
$0.050/min through September 12, 2026, $0.065/min after. That rate covers Deepgram's
audio legs (listen, speak, session orchestration) only; it does not include the LLM
call, which never touches Deepgram's infrastructure. New accounts get $200 in credit
usable across all Deepgram products with no card required to start — at $0.050/min
that's roughly 4,000 minutes (~66 hours) of session time before anything would need to
be paid.

Anthropic: billed separately and directly for the Opus 5 calls `agent/think` makes —
same calls, same cost basis as the Tool Runner already made today from
`agent/turns`. Nothing about this design changes Anthropic spend; it only changes who
calls the endpoint that triggers it.

**Unverified — check before relying on it:** whether the $0.050 promotional rate
requires anything beyond having an account, confirmable in the Deepgram dashboard.

## 8. Error handling and open questions

- Missing `DEEPGRAM_API_KEY` → `agent-token`'s route throws at request time naming the
  variable, same convention as the harness doc's §7.
- Deepgram auth-grant failure → `agent-token` returns 502; client shows the same
  `"Something went wrong"` state used elsewhere.
- A tool throwing inside `agent/think`'s Tool Runner call → returned as an error result
  to the model, per the SDK's existing contract; unchanged from today.
- **Resolved:** whether the Voice Agent session auto-truncates in-flight TTS audio
  server-side on `UserStartedSpeaking`, or leaves that to the client — Deepgram's own
  docs didn't say, but `@deepgram/agents`' source does: `AgentPlayer.interrupt()` closes
  and discards the playback `AudioContext`, and its own comment says to call it exactly
  on that event. Nothing server-side is assumed; §5 wires this in `voice-session.ts`.
- **Open, needs hands-on verification:** whether the custom `think` endpoint contract
  supports a streaming response (`stream: true`, incremental deltas) the way OpenAI's
  chat-completions API does. If it doesn't, the harness doc's §5 mitigation — handing
  the first sentence to TTS without waiting for the rest — isn't available on this leg,
  and the two-model-round-trip latency (turn 1 decides on a tool call, turn 2 phrases
  the result) lands as a single round-trip wait instead of a pipelined one. Worth
  measuring with `timing.ts` before deciding whether it matters.

## 9. Non-goals, carried over unchanged from the harness doc's §8

No extraction, no scoring, no writes from the agent, no tier gating beyond what §2
already argues (no tool reaching Tier 1+ exists yet to gate), no `Ledger` entries from
agent activity. One addition: **no cross-session conversation persistence** — a session
is many turns while the socket is open, but nothing is stored once it closes. That's
the same non-goal the harness doc stated for single-turn requests, just restated for a
unit that's now a session instead of a request.
