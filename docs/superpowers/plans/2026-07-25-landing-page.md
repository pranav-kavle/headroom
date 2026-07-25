# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder home page with a public marketing landing page (faithful port of the prototype `view-landing` screen) that explains the product and drives Clerk sign-up.

**Architecture:** A Server-Component `page.tsx` composes seven focused section components under `src/components/landing/`. Only the two pieces that touch Clerk auth (`LandingNav`, `SignUpCta`) are Client Components. Landing-specific styles live in a scoped `Landing.module.css`; shared primitives (`btn`, `serif`, `mono`, `disclaimer`) come from the existing global `globals.css`.

**Tech Stack:** Next.js 15 App Router, TypeScript, React Server/Client Components, Clerk (`@clerk/nextjs`), CSS Modules.

## Global Constraints

- Copy is verbatim from the prototype `.claude/worktrees/priority-engine-mcp-scaffold/cashflow-companion (5).html` (view-landing, HTML lines 1593–1737). Do not paraphrase headlines or body copy.
- The canonical Safe-to-Pay number is **$3,650** (range **$3,650–$5,050**). Use no other figure.
- No new npm dependencies. No backend, no API routes, no tests-with-logic (static page).
- Reuse global classes `btn primary|ghost|lg`, `serif`, `mono`, `disclaimer` — do not redefine them in the module.
- Landing-specific CSS goes only in `src/components/landing/Landing.module.css`; do not add landing styles to `globals.css`.
- Client Components (`"use client"`) only where Clerk hooks/components are used: `LandingNav`, `SignUpCta`.
- This is UI with no logic, so there are no unit tests. Each task's verification is a TypeScript compile; the final task adds a dev-server visual check.

---

### Task 1: Landing styles + SVG primitives

**Files:**
- Create: `src/components/landing/Landing.module.css`
- Create: `src/components/landing/BrandMark.tsx`
- Create: `src/components/landing/icons.tsx`

**Interfaces:**
- Produces: CSS Module `styles` with camelCase keys: `lpInner`, `lpNav`, `lpActions`, `lpLink`, `lpHero`, `lpEyebrow`, `lpSub`, `lpCta`, `lpMock`, `float`, `mockCard`, `mockLbl`, `mockNum`, `mockRange`, `mockFoot`, `mockBadge`, `mockChip`, `hpill`, `lpTrust`, `trustItem`, `tk`, `tv`, `lpSec`, `tint`, `secEyebrow`, `lead`, `steps`, `step`, `sn`, `tag`, `lpTwo`, `featureCard`, `amber`, `miniTxn`, `amt`, `q`, `miniConf`, `lpFoot`, `brand`, `mark`, `name`, `sub`.
- Produces: `BrandMark()` — React component rendering the 16×16 white check-arrow SVG.
- Produces: `ShieldIcon`, `FileIcon`, `DocIcon`, `WarnIcon` — each `({ size?: number }) => JSX.Element` (default size 20; WarnIcon default 12).

- [ ] **Step 1: Create `Landing.module.css`** with the ported prototype styles (translated to camelCase class names; global tokens like `var(--green)` used as-is):

```css
/* Landing page styles — ported from prototype view-landing
   (.claude/worktrees/priority-engine-mcp-scaffold/cashflow-companion (5).html) */

.lpInner { max-width: 1180px; margin: 0 auto; padding: 0 44px; }

/* nav */
.lpNav { display: flex; align-items: center; justify-content: space-between; padding: 24px 0; }
.lpActions { display: flex; align-items: center; gap: 10px; }
.lpLink { color: var(--ink-2); font-weight: 600; font-size: 14px; padding: 9px 13px; border-radius: 9px; transition: background .15s; }
.lpLink:hover { background: var(--paper-2); }

/* brand */
.brand { display: flex; align-items: center; gap: 10px; }
.mark { width: 30px; height: 30px; border-radius: 9px; flex: none; background: linear-gradient(135deg, var(--green), #147a61); display: grid; place-items: center; color: #fff; box-shadow: var(--sh-sm); }
.name { font-weight: 700; font-size: 15px; letter-spacing: -0.02em; }
.sub { font-size: 11px; color: var(--ink-3); margin-top: -2px; }

/* hero */
.lpHero { display: grid; grid-template-columns: 1.02fr .98fr; gap: 56px; align-items: center; padding: 48px 0 72px; }
.lpEyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: var(--green); font-weight: 700; margin-bottom: 22px; }
.lpHero h1 { font-size: 60px; line-height: 1.04; letter-spacing: -0.02em; }
.lpHero h1 em { font-style: italic; color: var(--green); }
.lpSub { font-size: 18px; line-height: 1.62; color: var(--ink-2); margin-top: 24px; max-width: 45ch; }
.lpSub b { color: var(--ink); font-weight: 600; }
.lpCta { display: flex; align-items: center; gap: 16px; margin-top: 32px; }

/* product mock */
.lpMock { position: relative; padding: 8px; }
.float { animation: float 7s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.mockCard { position: relative; overflow: hidden; border-radius: 22px; color: #fff; padding: 32px 34px; box-shadow: var(--sh-lg); background: linear-gradient(150deg, #114b3d 0%, #0E5C4A 46%, #12705a 100%); }
.mockCard::after { content: ""; position: absolute; inset: 0; opacity: .55; pointer-events: none; background: radial-gradient(560px 300px at 92% -30%, rgba(255,255,255,.16), transparent 62%); }
.mockLbl { font-size: 11.5px; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.72); font-weight: 600; position: relative; }
.mockNum { font-size: 60px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; margin: 12px 0 0; position: relative; }
.mockRange { font-size: 13.5px; color: rgba(255,255,255,.85); margin-top: 13px; position: relative; }
.mockRange b { color: #fff; font-weight: 600; }
.mockFoot { margin-top: 20px; display: flex; gap: 9px; flex-wrap: wrap; position: relative; }
.hpill { background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.18); color: #fff; font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 999px; }
.mockBadge { position: absolute; top: -14px; left: -14px; background: #fff; color: var(--amber); border: 1px solid rgba(181,120,11,.28); box-shadow: var(--sh-md); font-size: 12px; font-weight: 700; padding: 8px 13px; border-radius: 12px; display: flex; align-items: center; gap: 7px; z-index: 2; }
.mockChip { position: absolute; bottom: -20px; right: -6px; background: #fff; border: 1px solid var(--hair); box-shadow: var(--sh-md); border-radius: 14px; padding: 12px 15px; max-width: 220px; z-index: 2; }

/* trust strip */
.lpTrust { border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); background: rgba(255,255,255,.5); }
.lpTrust .lpInner { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; padding-top: 28px; padding-bottom: 28px; }
.trustItem { display: flex; gap: 12px; align-items: flex-start; }
.trustItem svg { flex: none; color: var(--green); margin-top: 2px; }
.tk { font-weight: 700; font-size: 13.5px; }
.tv { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; line-height: 1.45; }

/* content sections */
.lpSec { padding: 78px 0; }
.tint { background: rgba(255,255,255,.55); border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
.secEyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: var(--green); font-weight: 700; margin-bottom: 16px; }
.lpSec h2 { font-size: 34px; letter-spacing: -0.02em; max-width: 22ch; }
.lead { font-size: 17px; color: var(--ink-2); line-height: 1.66; max-width: 62ch; margin-top: 18px; }
.lead b { color: var(--ink); font-weight: 600; }

/* how-it-works steps */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 42px; }
.step { background: var(--card); border: 1px solid var(--hair); border-radius: 18px; padding: 26px; box-shadow: var(--sh-sm); }
.sn { width: 34px; height: 34px; border-radius: 10px; background: var(--green-soft); color: var(--green-ink); display: grid; place-items: center; font-weight: 700; font-family: var(--font-tabular); margin-bottom: 16px; }
.step h3 { font-size: 16.5px; }
.step p { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; margin-top: 8px; }
.tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--green); margin-top: 14px; display: inline-block; }

/* feature cards */
.lpTwo { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; margin-top: 8px; }
.featureCard { background: var(--card); border: 1px solid var(--hair); border-radius: 20px; padding: 30px; box-shadow: var(--sh-md); }
.amber { background: linear-gradient(160deg, #FFFDF8, #FCF6EA); border-color: rgba(181,120,11,.22); }
.featureCard h3 { font-size: 19px; }
.featureCard p { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin-top: 10px; }
.miniTxn { background: var(--paper); border: 1px solid var(--hair); border-radius: 14px; padding: 16px 18px; margin-top: 20px; }
.amt { font-family: var(--font-tabular); font-weight: 700; font-size: 17px; }
.q { font-size: 13px; color: var(--ink-2); margin-top: 6px; }
.miniConf { height: 6px; border-radius: 6px; background: var(--paper-2); margin-top: 13px; overflow: hidden; }
.miniConf i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #1E3A5F, #2f5687); width: 61%; }

/* footer */
.lpFoot { border-top: 1px solid var(--hair); padding: 32px 0; color: var(--ink-3); font-size: 12.5px; }
.lpFoot .lpInner { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; align-items: center; }

/* responsive */
@media (max-width: 980px) {
  .lpHero, .steps, .lpTwo { grid-template-columns: 1fr; }
  .lpTrust .lpInner { grid-template-columns: 1fr; }
  .lpHero h1 { font-size: 42px; }
  .lpInner { padding: 0 20px; }
  .lpMock { margin-top: 20px; }
}
```

- [ ] **Step 2: Create `BrandMark.tsx`**

```tsx
export function BrandMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14l5-5 4 4 7-7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6h4v4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Create `icons.tsx`**

```tsx
type IconProps = { size?: number };

export function ShieldIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.5 3.4 7.6 8 9 4.6-1.4 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FileIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function DocIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function WarnIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "src/components/landing" || echo "no landing errors"`
Expected: `no landing errors` (pre-existing `packages/**` es2018 warnings are unrelated and ignored).

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/Landing.module.css src/components/landing/BrandMark.tsx src/components/landing/icons.tsx
git commit -m "Add landing page styles and SVG primitives"
```

---

### Task 2: Auth client components

**Files:**
- Create: `src/components/landing/SignUpCta.tsx`
- Create: `src/components/landing/LandingNav.tsx`

**Interfaces:**
- Consumes: `BrandMark` (Task 1), `styles` from `Landing.module.css` (Task 1).
- Produces: `SignUpCta({ children, className }: { children: React.ReactNode; className?: string })` — wraps a `<button className={className}>` in Clerk `<SignUpButton mode="modal">`.
- Produces: `LandingNav()` — the top nav bar.

- [ ] **Step 1: Create `SignUpCta.tsx`**

```tsx
"use client";

import { SignUpButton } from "@clerk/nextjs";

export function SignUpCta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SignUpButton mode="modal">
      <button className={className}>{children}</button>
    </SignUpButton>
  );
}
```

- [ ] **Step 2: Create `LandingNav.tsx`**

```tsx
"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { BrandMark } from "./BrandMark";
import styles from "./Landing.module.css";

export function LandingNav() {
  return (
    <nav className={styles.lpNav}>
      <div className={styles.brand}>
        <div className={styles.mark}>
          <BrandMark />
        </div>
        <div>
          <div className={styles.name}>Headroom</div>
          <div className={styles.sub}>Safe-to-Pay, defended.</div>
        </div>
      </div>
      <div className={styles.lpActions}>
        <a className={styles.lpLink} href="#how">
          How it works
        </a>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="btn ghost">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn primary">Get started</button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "src/components/landing" || echo "no landing errors"`
Expected: `no landing errors`.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/SignUpCta.tsx src/components/landing/LandingNav.tsx
git commit -m "Add landing nav and sign-up CTA client components"
```

---

### Task 3: Content section components

**Files:**
- Create: `src/components/landing/MockCard.tsx`
- Create: `src/components/landing/Hero.tsx`
- Create: `src/components/landing/TrustBar.tsx`
- Create: `src/components/landing/Problem.tsx`
- Create: `src/components/landing/HowItWorks.tsx`
- Create: `src/components/landing/FeatureCards.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

**Interfaces:**
- Consumes: `styles` (Task 1), `WarnIcon`/`ShieldIcon`/`FileIcon`/`DocIcon` (Task 1), `SignUpCta` (Task 2).
- Produces: `MockCard()`, `Hero()`, `TrustBar()`, `Problem()`, `HowItWorks()`, `FeatureCards()`, `LandingFooter()` — all Server Components. `Hero` and `FeatureCards` render `<SignUpCta>` for their CTAs. `HowItWorks` renders `<section id="how">`.

- [ ] **Step 1: Create `MockCard.tsx`**

```tsx
import styles from "./Landing.module.css";
import { WarnIcon } from "./icons";

export function MockCard() {
  return (
    <div className={styles.lpMock}>
      <div className={styles.float}>
        <div className={styles.mockCard}>
          <span className={styles.mockBadge}>
            <WarnIcon /> The catch
          </span>
          <div className={styles.mockLbl}>Safe-to-Pay this period</div>
          <div className={`${styles.mockNum} mono`}>$3,650</div>
          <div className={styles.mockRange}>
            Range <b className="mono">$3,650–$5,050</b> · conservative end shown
          </div>
          <div className={styles.mockFoot}>
            <span className={styles.hpill}>Taxes funded</span>
            <span className={styles.hpill}>Floor $6,000</span>
            <span className={styles.hpill}>Schedule C · CA</span>
          </div>
        </div>
        <div className={styles.mockChip}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", fontWeight: 700 }}>
            Reads &amp; recommends
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
            Never moves your money.
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `Hero.tsx`**

```tsx
import styles from "./Landing.module.css";
import { MockCard } from "./MockCard";
import { SignUpCta } from "./SignUpCta";

export function Hero() {
  return (
    <div className={styles.lpHero}>
      <div>
        <div className={styles.lpEyebrow}>For Schedule C freelancers</div>
        <h1 className="serif">
          Know exactly how much you can <em>pay yourself.</em> Every week.
        </h1>
        <p className={styles.lpSub}>
          Irregular income. Quarterly tax dread. The one question you can never
          quite answer: <b>can I afford to pay myself this month?</b> Cashflow
          Companion answers it — and defends the number.
        </p>
        <div className={styles.lpCta}>
          <SignUpCta className="btn primary lg">Connect your bank</SignUpCta>
        </div>
      </div>
      <MockCard />
    </div>
  );
}
```

- [ ] **Step 3: Create `TrustBar.tsx`**

```tsx
import styles from "./Landing.module.css";
import { ShieldIcon, FileIcon, DocIcon } from "./icons";

export function TrustBar() {
  return (
    <div className={styles.lpTrust}>
      <div className={styles.lpInner}>
        <div className={styles.trustItem}>
          <ShieldIcon />
          <div>
            <div className={styles.tk}>Reads your data. Recommends only.</div>
            <div className={styles.tv}>It watches the accounts and advises. It never moves a dollar.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <FileIcon />
          <div>
            <div className={styles.tk}>Built for Schedule C.</div>
            <div className={styles.tv}>Sole-proprietor freelancers with lumpy, unpredictable income.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <DocIcon />
          <div>
            <div className={styles.tk}>Estimates you can take to your accountant.</div>
            <div className={styles.tv}>Every figure is a range with its assumption stated — the low end is the promise.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `Problem.tsx`**

```tsx
import styles from "./Landing.module.css";

export function Problem() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>The problem</div>
        <h2 className="serif">When income is irregular, every dollar is contested.</h2>
        <p className={styles.lead}>
          A retainer here, an invoice that lands three weeks late there. Meanwhile
          taxes, a runway floor, your own pay, savings and debt are all pulling at
          the same balance. Guess high and you claw it back next month; guess low
          and you underpay yourself all year. <b>Allocation collapses under
          uncertainty</b> — so the honest answer to “how much can I pay myself?” is
          usually “I don’t know.”
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `HowItWorks.tsx`**

```tsx
import styles from "./Landing.module.css";

export function HowItWorks() {
  return (
    <section id="how" className={`${styles.lpSec} ${styles.tint}`}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>How it works</div>
        <h2 className="serif">One question, answered continuously.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.sn}>1</div>
            <h3>Connect &amp; classify</h3>
            <p>It reads your bank data and classifies real income — even the messy deposits. Unsure ones come to you for a one-tap confirm.</p>
            <span className={styles.tag}>AI · judgment</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>2</div>
            <h3>Solve the waterfall</h3>
            <p>A deterministic engine owns the math: taxes, then runway floor, then pay, then savings, then debt. Same inputs, same answer — every time.</p>
            <span className={styles.tag}>Engine · arithmetic</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>3</div>
            <h3>Re-plan &amp; surface one thing</h3>
            <p>It re-plans in the background as reality changes and surfaces the single decision worth your attention — or stays silent.</p>
            <span className={styles.tag}>Earned attention</span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `FeatureCards.tsx`**

```tsx
import styles from "./Landing.module.css";
import { SignUpCta } from "./SignUpCta";

export function FeatureCards() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.lpTwo}>
          <div className={styles.featureCard}>
            <div className={styles.secEyebrow}>The AI-hard part</div>
            <h3>Real income is messy.</h3>
            <p>
              A Zelle payment with the memo “inv” could be a client invoice or your
              roommate paying rent. The engine won’t bank it until the model reads
              the evidence and you confirm.
            </p>
            <div className={styles.miniTxn}>
              <div className={styles.amt}>$4,200 · Zelle from J. Rivera</div>
              <div className={styles.q}>memo “inv” — client income or personal?</div>
              <div className={styles.miniConf}>
                <i />
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, fontFamily: "var(--font-tabular)" }}>
                confidence 61% · escalated for confirm
              </div>
            </div>
          </div>
          <div className={`${styles.featureCard} ${styles.amber}`}>
            <div className={styles.secEyebrow} style={{ color: "var(--amber)" }}>The catch</div>
            <h3>It sees the shortfall weeks early.</h3>
            <p>
              When Acme’s $5,000 invoice slips 30 days, Headroom catches
              the tax-and-runway squeeze before it lands — lowers your Safe-to-Pay
              to a number you can trust, and protects the floors first.
            </p>
            <div style={{ marginTop: 20 }}>
              <SignUpCta className="btn primary">See the catch →</SignUpCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `LandingFooter.tsx`**

```tsx
import styles from "./Landing.module.css";

export function LandingFooter() {
  return (
    <div className={styles.lpFoot}>
      <div className={styles.lpInner}>
        <span>Demo build · scripted data. No money moves. Read &amp; recommend only.</span>
        <span>Estimates — confirm with your accountant.</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "src/components/landing" || echo "no landing errors"`
Expected: `no landing errors`.

- [ ] **Step 9: Commit**

```bash
git add src/components/landing/MockCard.tsx src/components/landing/Hero.tsx src/components/landing/TrustBar.tsx src/components/landing/Problem.tsx src/components/landing/HowItWorks.tsx src/components/landing/FeatureCards.tsx src/components/landing/LandingFooter.tsx
git commit -m "Add landing page content sections"
```

---

### Task 4: Compose page + end-to-end verification

**Files:**
- Modify: `src/app/page.tsx` (replace entire file)

**Interfaces:**
- Consumes: all section components from Tasks 2–3.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import styles from "@/components/landing/Landing.module.css";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <main>
      <div className={styles.lpInner}>
        <LandingNav />
        <Hero />
      </div>
      <TrustBar />
      <Problem />
      <HowItWorks />
      <FeatureCards />
      <LandingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "src/(app/page|components/landing)" || echo "no landing errors"`
Expected: `no landing errors`.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (background), then load `http://localhost:3000`.

- [ ] **Step 4: Visual verification checklist**

Confirm on the loaded page:
- All seven sections render in order: nav → hero (green $3,650 mock card, amber "The catch" badge, floating) → trust bar (3 items) → problem → tinted "how it works" (3 steps) → two feature cards (second is amber) → footer.
- Signed-out: nav shows "Sign in" (ghost) + "Get started" (primary); hero "Connect your bank" and the amber card's "See the catch →" all open the Clerk **sign-up** modal; "Sign in" opens the **sign-in** modal.
- "How it works" nav link scrolls to the steps section.
- Narrow the window to ≤980px: hero, steps, feature cards, and trust items each collapse to one column; hero headline shrinks.
- With OS "reduce motion" on, the mock card does not float.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "Replace placeholder home with marketing landing page"
```

---

## Self-Review

**Spec coverage:**
- Route/auth behavior (signed-out CTAs → sign-up, sign-in link, signed-in UserButton) → Task 2 (`LandingNav`, `SignUpCta`), verified Task 4 Step 4. ✓
- Seven sections → Tasks 2–3, composed Task 4. ✓
- Component structure under `src/components/landing/` → Tasks 1–3 match spec's file list (`BrandMark`, `icons`, `SignUpCta`, `LandingNav`, `MockCard`, `Hero`, `TrustBar`, `Problem`, `HowItWorks`, `FeatureCards`, `LandingFooter`, `Landing.module.css`). ✓
- Reuse global primitives, landing CSS scoped to module → enforced in Global Constraints and Task 1 CSS. ✓
- Responsive 980px + reduced-motion → Task 1 CSS + Task 4 Step 4. ✓
- Verbatim copy + $3,650 only → Global Constraints; copy transcribed in Tasks 2–3. ✓

**Placeholder scan:** No TBD/TODO; every component and CSS rule is written in full. ✓

**Type consistency:** `SignUpCta({ children, className })` defined in Task 2, consumed identically in Hero (Task 3 Step 2) and FeatureCards (Task 3 Step 6). Icon components `({ size?: number })` defined Task 1, consumed in MockCard/TrustBar. `styles` module keys used in components all exist in the Task 1 CSS. ✓
