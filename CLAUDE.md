# Cashflow Companion — Claude Instructions

## Project Skill

When working on this codebase, load the project context skill first:

```
Skill: cashflow-companion-context
Location: .claude/skills/cashflow-companion-context/SKILL.md
```

This skill covers: architecture, AI/deterministic boundary, Demo Day acceptance bars, canonical scenario ($3,650), MCP sources, tech stack, and cut order.

## Key Constraints (short form — full detail in skill)

- The model NEVER computes or overrides a financial figure — the Priority Engine MCP does all arithmetic
- Demo Day: Aug 14, 2026 · Current week: W4 (Jul 14–20)
- The canonical Safe-to-Pay number is **$3,650** (Acme slips scenario) — use no other number in artifacts
- Demo runs on scripted/sandbox data — no live bank OAuth on stage
