"use client";

import { useEffect, useRef } from "react";
import type { VoiceStatus } from "./VoiceRecorder";
import styles from "./VoiceOrb.module.css";

const BAR_COUNT = 5;

// What the bars settle at per state once motion is off. Freezing the live
// level instead would leave five flat dots — a silhouette that reads "silent"
// in every state, which is precisely the distinction motion was carrying.
const STILL_LEVEL: Record<VoiceStatus, number> = {
  idle: 0.1,
  connecting: 0.12,
  listening: 0.62,
  thinking: 0.24,
  speaking: 0.72,
  error: 0.12,
};

// Fast attack, slow release. The asymmetry is what makes the cluster read as
// audio rather than as a meter — a symmetric filter looks mechanical.
const ATTACK = 0.5;
const RELEASE = 0.15;

/**
 * The session's live audio level, drawn as a five-bar cluster.
 *
 * `getLevel` is read once per animation frame and written straight to a CSS
 * variable, deliberately bypassing React: this updates at 60fps and must not
 * re-render the transcript underneath it.
 *
 * The level it draws is always a real measurement (design doc core rule 1 —
 * the model never produces a figure, and neither does this). When the session
 * has no signal to give — connecting, thinking, or a shut mic — the level is
 * genuinely 0 and the bars genuinely rest.
 */
export function VoiceOrb({
  status,
  getLevel,
  size = 30,
}: {
  status: VoiceStatus;
  getLevel: () => number;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      element.style.setProperty("--level", String(STILL_LEVEL[status]));
      return;
    }

    let frame = 0;
    let smoothed = 0;
    const step = () => {
      const target = getLevel();
      smoothed += (target - smoothed) * (target > smoothed ? ATTACK : RELEASE);
      element.style.setProperty("--level", smoothed.toFixed(3));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [getLevel, status]);

  return (
    <div
      ref={ref}
      className={styles.orb}
      data-status={status}
      style={{ "--size": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <b key={index} />
      ))}
    </div>
  );
}
