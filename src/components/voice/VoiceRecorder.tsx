"use client";

import { useEffect, useRef, useState } from "react";
import { AgentCitation } from "@headroom/contracts";
import { VoiceOrb } from "./VoiceOrb";
import styles from "./VoiceRecorder.module.css";

// Design doc 2026-08-12-deepgram-voice-agent-design.md §6: the mic stays open
// for the whole session once started rather than being a press-and-hold
// gesture. VoiceOverlay owns the session lifecycle (it has to — starting it is
// a single tap on the FAB, before this component ever mounts); this component
// renders what that state looks like.
//
// "thinking" is emitted by voice-session.ts whenever the engine is working and
// neither party is talking. It used to be dropped, which left "Listening" on
// screen while the mic was shut and nothing was being heard.
export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export const VOICE_STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: "Ended",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Working it out",
  speaking: "Speaking",
  error: "Something went wrong",
};

export interface VoiceTurn {
  role: "user" | "assistant";
  content: string;
  citations: AgentCitation[];
  // Citations are fetched separately from the spoken turn (see VoiceOverlay),
  // so they always land after the text is already on screen. Knowing a fetch
  // is in flight lets the slot be reserved rather than appearing underneath
  // someone who has started reading.
  citationsPending?: boolean;
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0" />
      <path d="M12 17.5V21" />
      {muted && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function VoiceRecorder({
  status,
  errorMessage,
  turns,
  micOpen,
  muted,
  getLevel,
  onToggleSession,
  onToggleMute,
  onClose,
}: {
  status: VoiceStatus;
  // Bug 9/10: "Something went wrong" covered token failures, dropped
  // connections, and SDK errors alike with no way to tell them apart or know
  // what trying again would do. VoiceOverlay now names the actual cause; this
  // falls back to the generic label only if it didn't.
  errorMessage?: string;
  turns: VoiceTurn[];
  micOpen: boolean;
  muted: boolean;
  getLevel: () => number;
  onToggleSession: () => void;
  onToggleMute: () => void;
  onClose: () => void;
}) {
  // On by default: provenance is the reason the agent is allowed to say any of
  // this, so hiding it is the user's deliberate choice, never the default.
  const [showEvidence, setShowEvidence] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const sessionActive = status === "connecting" || status === "listening" ||
    status === "thinking" || status === "speaking";
  const label = status === "error" && errorMessage ? errorMessage : VOICE_STATUS_LABELS[status];

  // Follows the conversation as it grows. Keyed on the turn count rather than
  // on `turns` so a citation resolving into an already-read turn doesn't yank
  // the view to the bottom underneath the reader.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns.length]);

  return (
    <div className={styles.stage}>
      <header className={styles.top}>
        <button type="button" className={styles.close} aria-label="Close voice" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
        <div className={styles.title}>Voice</div>
        <div className={styles.spacer} />
      </header>

      <div className={styles.head}>
        <VoiceOrb status={status} getLevel={getLevel} />
        {/* Announced rather than merely coloured: the status used to change
            silently, so a screen reader user had no way to know the agent had
            started speaking or that the mic had closed. */}
        <div className={styles.status} data-status={status} role="status" aria-live="polite">
          {label}
        </div>
        <div className={styles.spacer} />
        {/* voice-session.ts holds the mic shut for the whole of the agent's
            turn. Rendering a live-looking mic through that window told the
            user they could barge in, and their words were dropped. */}
        <div className={styles.micState} data-open={micOpen}>
          <MicIcon muted={!micOpen} />
          {micOpen ? "Mic open" : muted ? "Muted" : status === "speaking" ? "Mic closed while I speak" : "Mic closed"}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.log} ref={logRef}>
          {turns.length === 0 && (
            <p className={styles.placeholder}>Say something to get started.</p>
          )}
          {turns.map((turn, index) =>
            turn.role === "user" ? (
              <div key={index} className={styles.user}>
                <em>You</em>
                <p>{turn.content}</p>
              </div>
            ) : (
              <div key={index} className={styles.agent}>
                <p>{turn.content}</p>
                {/* Design doc §9: voice carries the narrative, the screen
                    carries the evidence — voice is never the sole channel. */}
                {showEvidence && (turn.citationsPending || turn.citations.length > 0) && (
                  <div className={styles.citations}>
                    {turn.citationsPending ? (
                      <div className={styles.citationPending} aria-hidden="true" />
                    ) : (
                      turn.citations.map((citation) => (
                        <div key={citation.artifactId} className={styles.citation}>
                          <span className={styles.citationMark} aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                              <path d="M7 8h4v4a4 4 0 01-4 4M15 8h4v4a4 4 0 01-4 4" />
                            </svg>
                          </span>
                          <span className={styles.citationQuote}>&ldquo;{citation.quote}&rdquo;</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <div className={styles.dock}>
        <button type="button" className={styles.dockButton} data-kind="end" onClick={onToggleSession}>
          {sessionActive ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <rect x="6" y="6" width="12" height="12" rx="2.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
              <path d="M7 5l12 7-12 7z" strokeLinejoin="round" />
            </svg>
          )}
          {sessionActive ? "End" : status === "error" ? "Try again" : "Start"}
        </button>
        <button
          type="button"
          className={styles.dockButton}
          aria-pressed={muted}
          disabled={!sessionActive}
          onClick={onToggleMute}
        >
          <MicIcon muted={muted} />
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className={styles.dockButton}
          aria-pressed={showEvidence}
          onClick={() => setShowEvidence((shown) => !shown)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
            <path d="M5 6h14M5 12h14M5 18h9" />
          </svg>
          Evidence
        </button>
      </div>
    </div>
  );
}
