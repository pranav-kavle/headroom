# Marketing Landing Page — Design Spec

*2026-07-25 · branch `feat/landing-page`*

## Goal

Replace the placeholder "design system check" home ([`src/app/page.tsx`](../../../src/app/page.tsx))
with a public marketing landing page for a first-time visitor. It explains the
product and drives sign-up via the already-wired Clerk flow. This is a faithful
port of the `view-landing` screen from the UI prototype
(`.claude/worktrees/priority-engine-mcp-scaffold/cashflow-companion (5).html`).

Non-goals: no dashboard, no onboarding flow, no backend, no new dependencies, no
demo route. The catch/dashboard screens in the prototype are out of scope.

## Audience & auth behavior

- **Route:** `/` (replaces current `page.tsx`). Public / unauthenticated.
- **Signed-out visitor:** sees nav "Sign in" (ghost) + "Get started" (primary),
  and hero/catch CTAs — all open the Clerk **sign-up** modal (`SignUpButton mode="modal"`).
  "Sign in" opens the Clerk **sign-in** modal (`SignInButton mode="modal"`).
- **Signed-in visitor:** nav auth buttons are replaced by a Clerk `<UserButton />`.
  No redirect (there is no app home yet). Achieved with Clerk `<Show when="signed-out|signed-in">`.

## Sections (top to bottom)

Faithful port of prototype markup at HTML lines 1595–1737. Copy is taken verbatim
from the prototype.

1. **Nav (`LandingNav`)** — brand mark (green rounded square + white check-arrow
   SVG) + "Headroom" / "Safe-to-Pay, defended." · a "How it works"
   anchor link to `#how` · auth actions (Client Component).
2. **Hero (`Hero`)** — eyebrow "For Schedule C freelancers"; serif headline
   *"Know exactly how much you can `<em>`pay yourself.`</em>` Every week."*; sub-copy;
   primary CTA "Connect your bank" → sign-up. Right side: the **floating mock card** —
   green gradient card, "The catch" amber badge, "Safe-to-Pay this period", `$3,650`
   (mono), "Range $3,650–$5,050 · conservative end shown", pills "Taxes funded /
   Floor $6,000 / Schedule C · CA", and a white "Reads & recommends — Never moves
   your money." chip. Float animation respects `prefers-reduced-motion`.
3. **Trust bar (`TrustBar`)** — 3 icon items: reads/recommends only · built for
   Schedule C · estimates for your accountant.
4. **Problem (`Problem`)** — eyebrow "The problem", h2 "When income is irregular,
   every dollar is contested.", lead paragraph.
5. **How it works (`HowItWorks`, `id="how"`, tinted)** — 3 numbered steps:
   Connect & classify (tag "AI · judgment") → Solve the waterfall (tag "Engine ·
   arithmetic") → Re-plan & surface one thing (tag "Earned attention").
6. **Feature cards (`FeatureCards`)** — two-up: "The AI-hard part" (messy income +
   a mini transaction card at 61% confidence) and "The catch" (amber gradient card;
   Acme's $5,000 invoice slips 30 days). The catch card's button → sign-up.
7. **Footer (`LandingFooter`)** — "Demo build · scripted data. No money moves. Read
   & recommend only." + "Estimates — confirm with your accountant."

## Component structure

```
src/app/page.tsx                     # composes the sections (Server Component)
src/components/landing/
  LandingNav.tsx                     # Client — Clerk auth actions + brand + anchor link
  Hero.tsx                           # Server content + <SignUpCta/> client button
  MockCard.tsx                       # static hero mock ($3,650)
  TrustBar.tsx
  Problem.tsx
  HowItWorks.tsx
  FeatureCards.tsx                   # includes catch card <SignUpCta/>
  LandingFooter.tsx
  SignUpCta.tsx                      # Client — thin wrapper over Clerk SignUpButton
  BrandMark.tsx                      # inline brand SVG
  icons.tsx                          # inline trust/feature SVGs
  Landing.module.css                 # ported lp-* / mock / step / feature styles
```

Only the pieces that touch Clerk (`LandingNav`, `SignUpCta`) are Client Components
(`"use client"`). Everything else is a Server Component. `MockCard`, `TrustBar`,
`Problem`, `HowItWorks`, `FeatureCards`, `LandingFooter` are pure static markup.

## Styling

- **Reuse existing global primitives** from `globals.css`: `btn primary/ghost/lg`,
  `serif`, `mono`, `disclaimer`. Do not duplicate these.
- **Landing-specific styles → `Landing.module.css`** (CSS Module, scoped). This keeps
  `globals.css` limited to cross-view primitives, as its header comment requires.
  Ported rules (from prototype CSS, HTML lines listed): `.lp-inner` (404),
  `.lp-nav/.lp-actions/.lp-link` (405–409), `.lp-hero/.lp-eyebrow/.lp-sub/.lp-cta`
  (410–416), `.lp-mock/.float` + `@keyframes float` (419–421), `.mock-*` (422–433),
  `.lp-trust/.trust-item/.tk/.tv` (435–440), `.lp-sec/.sec-eyebrow/.lead` (442–447),
  `.steps/.step/.sn/.tag` (448–453), `.lp-two/.feature-card(.amber)` (454–458),
  `.mini-txn/.mini-conf` (459–464), `.lp-foot` (465–466), brand `.brand/.mark/.name/.sub`
  (83–90).
- **Responsive:** single breakpoint at `max-width: 980px` — hero, steps, feature
  cards, and trust grid collapse to one column; hero h1 → 42px; `.lp-inner` padding
  → 20px (prototype lines 496–499).
- Because CSS Module class names are hashed, the ported selectors (which the
  prototype writes as descendant combinators like `.brand .mark`) are rewritten to
  reference `styles.*` on the JSX, or kept as nested selectors within the module
  where a wrapper class is present.

## Verification

No tests (static marketing page, no logic). Verify by running the app and confirming:
1. `/` renders all seven sections with prototype styling (green hero mock, tinted
   "how it works", amber catch card).
2. Signed-out: "Get started" / "Connect your bank" / catch button open the Clerk
   sign-up modal; "Sign in" opens the sign-in modal.
3. Signed-in: nav shows `UserButton`, no auth buttons.
4. "How it works" nav link scrolls to the steps section.
5. Layout collapses cleanly at ≤980px; float animation is disabled under
   reduced-motion.

## Risks / notes

- Clerk `Show`/`SignInButton`/`SignUpButton`/`UserButton` are already used in the
  current `page.tsx`, so the integration is proven.
- The prototype's mono font is referenced as `'JetBrains Mono'`; in this app it is
  bound via the `--font-tabular` / `.mono` token — ported rules use the token, not
  the literal font name.
- Brand mark and icon SVGs are copied verbatim from the prototype (viewBox 24×24).
