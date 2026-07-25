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
