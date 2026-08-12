# The voice agent harness

Companion to `docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`
(§3 core rule 4 "voice is STT → text → engine → TTS", §7 the deterministic
engine, §8 action tiers, §9 voice) and to
`docs/superpowers/specs/2026-08-12-brief-voice-overlay-design.md`, which built
the voice *sheet* against a stub transcriber and explicitly left the agent out.

This pass builds the thing you can hold a conversation with: real speech in,
a tool-calling agent loop in the middle, real speech out. It deliberately
builds the harness before the extraction and scoring that will eventually fill
it, on the grounds that the harness is what everything later plugs into and
its shape is the part that must be right.

## 1. Why now, and what's actually in scope

Every screen is built and every screen renders an empty state, because nothing
creates a `Commitment` outside a test fixture. The two things that unblock real
data — extraction (§6) and the engine (§7) — are independent of each other and
of this pass. What all three share is the agent: extraction needs somewhere to
put a captured promise, the engine needs a caller, and the user needs a way in
that isn't a form.

In scope: a real Deepgram transcriber behind the existing `SttProvider` port, a
matching `TtsProvider` port and Deepgram Aura implementation, the first two
engine tools, an agent turn endpoint that streams text and tool events, audio
playback on the client, and per-leg latency instrumentation. Out of scope:
everything in §8 below.

## 2. Harness choice: Tool Runner, not the Agent SDK

The agent is `client.beta.messages.toolRunner()` from `@anthropic-ai/sdk` — the
loop driver in the regular SDK, over only the tools declared here.

Rejected: `@anthropic-ai/claude-agent-sdk`. It is Claude Code as a library and
ships built-in `Read`/`Write`/`Edit`/`Bash`/`Glob`/`Grep`/`WebSearch` plus a
harness tuned for long autonomous sessions on a filesystem. This agent's entire
capability surface is engine functions over Postgres, answering inside a single
voice turn. Adopting it would mean disabling most of what it provides.

Two consequences worth recording, because they are the reasons this choice
survives contact with later phases:

- **Tiers 1–3 are all the same shape.** Drafting a reply, sending it, commenting
  on a PR, preparing a booking — every one is an HTTP call, which is to say a
  tool. Adding the twentieth tool is no harder than the second.
- **Tier 4's code-writing is the one exception**, and it arrives as a *tool of*
  this agent rather than a replacement for it: a `fix_issue` tool whose
  implementation spawns a filesystem-capable agent in a sandbox and returns a
  branch URL. §14's deferral is unaffected either way.

The Tool Runner also exposes a per-turn hook that intercepts a pending tool call
before it executes. That is where §8's policy table is enforced — Tier 1 runs
unattended, Tier 2 bounces to the UI for one tap, Tier 3 is refused. No tier
gating is implemented this pass (no Tier 1+ tool exists yet), but the hook is
the reason the harness can host it without restructuring.

## 3. MCP stays an internal boundary, not a wire protocol

`packages/engine-mcp` remains an MCP server, because per §7 that is the
*enforcement mechanism* for core rule 1 — the model calls the engine as a tool,
so it structurally cannot do the arithmetic itself.

It is **not** exposed over the network to Anthropic. The MCP connector requires
a publicly reachable URL, which would mean putting the engine on the internet
for no benefit. Tool definitions are built from the engine's registered tools
and executed in-process; MCP is the shape of the port, not the transport.

## 4. What the agent may honestly say on day one

Core rule 2 binds the agent as much as the Brief: a statement about the user's
life is only utterable if it traces to a stored `Artifact`. With an empty graph
that leaves exactly two honest behaviours, and the system prompt says so:

- **Capture** — repeat back what it just heard, as stored, with its own words
  quoted. No counting, no date resolution, no ranking.
- **Read back** — answer from `get_state`, which returns rows that exist.

Anything comparative ("your third promise this week", "the most at risk")
requires engine tools this pass does not build, and the system prompt forbids
it rather than leaving it to chance.

**Date handling is the sharpest case of rule 1 and is resolved explicitly.**
The model may not turn "Thursday" into a date — a date is a computation. The
engine owns `now`: `get_state` returns today's date, and the model may only
repeat a date the engine gave it. It may quote the user's own phrase
("Thursday") verbatim, because that is transcription, not arithmetic.

Because the graph is empty, a dev-only seed script provides something true to
talk about — real `Person`/`Artifact`/`Commitment` rows with real quotes and
timestamps, so a demo exercises the honest path rather than an empty one.

## 5. Latency — the budget and the levers

§9 budgets 1.5–3s to first audio, "dominated by graph reasoning, not by
STT/TTS". A tool call means **two** model round trips, not one, so the naive
build misses this. Design decisions taken for latency:

| Leg | Decision |
|---|---|
| STT | Deepgram **prerecorded** (batch), not the streaming socket. Push-to-talk clips are short, the existing resend-clip client already fits it, and a duplex socket cannot live in a Next route handler (port rule 1). |
| Model, turn 1 | `claude-opus-5`, `effort: "low"`. Thinking stays **on** — see below. |
| Model, turn 2 | Same call; the first sentence is handed to TTS without waiting for the rest, per §9's stated mitigation. |
| Prompt | System prompt and tool schemas cached (`cache_control`); Opus 5's minimum cacheable prefix is 512 tokens, which the tool schemas clear. Per-turn transcript goes last so it never invalidates the prefix. |
| TTS | Deepgram Aura, streamed. Same vendor and key as STT — no second provider decision. |

**Thinking stays enabled deliberately, despite costing latency.** With
`thinking: {type: "disabled"}` Opus 5 can write a tool call into its visible
text instead of emitting a real tool call: the turn succeeds, the tool never
runs, and nothing errors. For this agent that means answering *without
consulting the engine* — a silent core-rule-1 violation invisible in logs.
`effort` is the latency knob instead.

Deferred but available if the budget is missed: `speed: "fast"` on Opus 5, and
a smaller model on the phrasing turn. The latter is architecturally safe *here*
specifically because rule 1 leaves turn 2 no reasoning to do — the engine
returns ordered reason strings the model may only rephrase.

## 6. Components

**`src/lib/stt.ts`** — `SttProvider` unchanged. Adds `DeepgramSttProvider`
calling Deepgram's prerecorded endpoint, passing the client's content type
through (§9 gotcha #2: Safari sends `audio/mp4`, not webm). `StubSttProvider`
stays for tests and for running without a key.

**`src/lib/tts.ts`** — new, mirroring `stt.ts`:
```ts
export interface TtsProvider {
  synthesize(text: string): Promise<ReadableStream<Uint8Array>>;
}
```
with `DeepgramTtsProvider` (Aura) and `StubTtsProvider`.

**`packages/engine-mcp/src/tools/`** — the first two of §7's seven:
- `get_action_policy(tier, kind)` → `allowed | needs_approval | forbidden`.
  Pure function of §8's table, no data access at all.
- `get_state(date?)` → today's date (engine-resolved) plus open commitments.
  §7's tool, minus capacity signals and load, which need `CapacitySignal` rows
  no connector produces.

Registered on the existing `createServer()` and exported as plain tool
definitions for the Tool Runner.

**`src/lib/agent.ts`** — builds the Tool Runner: system prompt (§4's two
permitted behaviours, stated as constraints), tool definitions from the engine,
model and effort per §5, `cache_control` placement.

**`src/app/api/v1/agent/turns/route.ts`** — `POST`, takes a transcript, returns
an SSE stream of text deltas and tool-call events. Text deltas render on the
screen as the answer forms; tool events carry the artifact IDs that become
citations, so the claim is spoken and the evidence is shown (§9).

**`src/app/api/v1/voice/speech/route.ts`** — `POST`, takes text, returns
streamed audio from `TtsProvider`. Kept separate from the SSE stream rather
than multiplexing audio into it.

**`src/components/voice/VoiceRecorder.tsx`** — on release, posts the transcript
to the agent endpoint and plays the returned audio. **Unlocks the
`AudioContext` inside the same `onPointerDown` handler that starts recording** —
§9 gotcha #1, currently not done, and the reason playback would otherwise fail
silently on iOS: the TTS audio arrives long after the gesture context is gone.

**`src/lib/timing.ts`** — records milliseconds per leg (STT, turn 1, tool,
turn 2, first audio byte) and logs one line per turn. Built now rather than
later so §5's budget is measured instead of estimated.

**`scripts/seed-dev-graph.ts`** — dev-only fixtures per §4.

**`packages/contracts/src/api.ts`** — `AgentTurnRequest`, the SSE event union,
and `SpeechRequest`, per port rule 3.

## 7. Error handling

- Missing `DEEPGRAM_API_KEY` or `ANTHROPIC_API_KEY` → the provider constructor
  throws at startup with the variable named, rather than failing per-request.
  Both are added to `.env.example`.
- Deepgram non-2xx → the transcription route returns 502; the sheet shows its
  existing `"Something went wrong"` state.
- A tool throwing inside the loop → returned to the model as an error result so
  it can recover, per the SDK's contract; the turn is not aborted.
- Model refusal (`stop_reason: "refusal"`) → checked before reading content, and
  surfaced as a plain message rather than an empty response.
- Zero commitments from `get_state` is valid and expected, not an error — the
  agent says it has nothing on file.

## 8. Explicit non-goals this pass

- **No extraction.** Nothing turns a transcript into a `Commitment`. Capture
  means "stored as an `Artifact` and repeated back", which is what already
  happens today.
- **No scoring.** No `score_risk`, no `compute_load`, no `get_brief`. The Brief
  keeps its current heuristic grouping until the engine can replace it.
- **No writes from the agent.** No `close_commitment`, no `record_label` — both
  need commitments to act on, and both are Tier 1 actions whose policy gate
  isn't built.
- **No tier gating.** The hook's existence is established in §2; no tool
  reaching Tier 1 or above exists to gate.
- **No streaming STT socket** — §5.
- **No conversation persistence.** One turn is one request; there is no stored
  thread. Multi-turn memory needs a decision about what a conversation *is* in
  graph terms, which this pass does not make.
- **No Ledger entries from agent activity.** `AgentRun`/`TriggerEvent` rows stay
  unwritten until there is an action worth auditing.
