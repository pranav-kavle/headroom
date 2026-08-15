# Slack stays read-only

**Decision.** Headroom requests Slack read scopes only. No `chat:write`.

**Why.** Posting to a channel is a tier 2 action — outward-facing, one tap,
never unattended. Until the approval pipeline covers Slack, holding a write
scope we cannot safely use is a liability rather than a feature.

**Revisit when.** The tier 2 approval path is wired for a second source
beyond GitHub.
