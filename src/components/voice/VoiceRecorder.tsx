"use client";

import { AgentCitation } from "@headroom/contracts";
import styles from "./VoiceRecorder.module.css";

// Design doc 2026-08-12-deepgram-voice-agent-design.md §6: barge-in needs the
// mic open *while the agent is speaking*, which a press-and-hold gesture
// can't express, so the mic stays open for the whole session once started.
// VoiceOverlay owns the session lifecycle (it has to — starting it is a
// single tap on the FAB, before this component ever mounts); this component
// only renders what that state looks like and forwards the mic-button tap.
export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export const VOICE_STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: "Tap to talk",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Speaking",
  error: "Something went wrong",
};

export interface VoiceTurn {
  role: "user" | "assistant";
  content: string;
  citations: AgentCitation[];
}

export function VoiceRecorder({
  status,
  errorMessage,
  turns,
  onToggleMic,
}: {
  status: VoiceStatus;
  // Bug 9/10: "Something went wrong" covered token failures, dropped
  // connections, and SDK errors alike with no way to tell them apart or know
  // what tapping the mic again would do. VoiceOverlay now names the actual
  // cause; this falls back to the generic label only if it didn't.
  errorMessage?: string;
  turns: VoiceTurn[];
  onToggleMic: () => void;
}) {
  const sessionActive = status === "connecting" || status === "listening" || status === "speaking";
  const label = status === "error" && errorMessage ? errorMessage : VOICE_STATUS_LABELS[status];
  const micCaption = status === "error" ? "Tap to try again" : sessionActive ? "Tap to end" : "Tap to start talking";

  return (
    <div className={styles.sheet}>
      <div className={styles.orb} data-status={status} />
      <div className={styles.listening}>{label}</div>

      <div className={styles.log}>
        {turns.length === 0 && <p className={styles.placeholder}>Say something to get started.</p>}
        {turns.map((turn, index) => (
          <div key={index} className={turn.role === "assistant" ? styles.reply : styles.transcript}>
            <p>{turn.content}</p>
            {/* Design doc §9: voice carries the narrative, the screen carries
                the evidence — voice is never the sole channel for a claim. */}
            {turn.citations.length > 0 && (
              <ul className={styles.citations}>
                {turn.citations.map((citation) => (
                  <li key={citation.artifactId}>&ldquo;{citation.quote}&rdquo;</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className={styles.micLive}>
        <button
          type="button"
          className={styles.micLg}
          aria-pressed={sessionActive}
          onClick={onToggleMic}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <rect x="9" y="2.5" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0013 0" />
            <path d="M12 17.5V21" />
          </svg>
        </button>
        <div className={styles.micCap}>{micCaption}</div>
      </div>
    </div>
  );
}
