# Headroom — Claude Instructions

Headroom reads GitHub, Gmail, Calendar, voice notes, and Google Health to
extract every commitment you've made, weigh it against your real capacity,
and tell you each morning what's actually at risk — with the work already
drafted. Full detail, including the life graph, extraction eval bar, action
tiers, and phasing:
`docs/superpowers/specs/2026-08-11-headroom-commitments-design.md`

## The core rule — verifiable autonomy (design doc §3)

1. **The engine computes. The model extracts and phrases.** No figure, date,
   duration, count, or score is ever produced by the model.
2. **Every claim carries provenance.** A statement about the user's life is
   only utterable if it traces to a stored `Artifact` with a quote,
   timestamp, and source link.
3. **The model never chooses its own autonomy tier.** Whether an action may
   execute is decided by deterministic policy from the action's tier.
4. **Voice is STT → text → engine → TTS.** Never speech-to-speech.
5. **When the engine cannot determine something, Headroom asks.** It does
   not guess and phrase the guess confidently.

## Action tiers & policy (design doc §8)

| Tier | Contents | Policy |
|---|---|---|
| 1 — Private, reversible | Draft replies, calendar holds, triage/labelling | Unattended, logged, undoable |
| 2 — Outward-facing | Send a reply, decline/move a meeting, comment on a PR | One tap, always — not togglable |
| 3 — Money & third parties | Purchases, bookings, cancellations | Prepared, never executed |
| 4 — Code | Draft review comments, fix trivial issues, push a branch | Deferred — see design doc §14 |

Tier 1 autonomy is only enabled once the extraction precision bar (≥90%
precision on `owed_by_me`, design doc §6) is met.
