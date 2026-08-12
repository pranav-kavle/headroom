"use client";

import { useCallback, useRef, useState } from "react";
import { AgentCitation, AgentTurnCitationsResponse } from "@headroom/contracts";
import { createVoiceSession, type VoiceSession } from "@/lib/voice-session";
import styles from "./VoiceRecorder.module.css";

// Tap-to-start / tap-to-end, not push-to-talk — design doc
// 2026-08-12-deepgram-voice-agent-design.md §6. Barge-in needs the mic open
// *while the agent is speaking*, which a press-and-hold gesture can't
// express, so the mic stays open for the whole session rather than only
// while a finger is on the button.
type Status = "idle" | "connecting" | "listening" | "speaking" | "error";

const LABELS: Record<Status, string> = {
  idle: "Tap to talk",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Speaking",
  error: "Something went wrong",
};

interface TurnEntry {
  role: "user" | "assistant";
  content: string;
  citations: AgentCitation[];
}

async function fetchLatestCitations(): Promise<AgentCitation[]> {
  // §6: citations for a turn are produced inside /api/v1/agent/think and
  // never travel over Deepgram's socket, so they're fetched separately
  // rather than read off the conversation-text event.
  const response = await fetch("/api/v1/agent/think/citations");
  if (!response.ok) return [];
  return AgentTurnCitationsResponse.parse(await response.json()).citations;
}

export function VoiceRecorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<TurnEntry[]>([]);
  const sessionRef = useRef<VoiceSession | null>(null);

  const handleConversationText = useCallback((message: { role: string; content: string }) => {
    const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
    let insertedIndex = -1;
    setTurns((prev) => {
      insertedIndex = prev.length;
      return [...prev, { role, content: message.content, citations: [] }];
    });

    if (role === "assistant") {
      void fetchLatestCitations().then((citations) => {
        if (citations.length === 0) return;
        setTurns((prev) => {
          if (insertedIndex < 0 || insertedIndex >= prev.length) return prev;
          const next = [...prev];
          next[insertedIndex] = { ...next[insertedIndex], citations };
          return next;
        });
      });
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    // Deliberately not awaited before calling createVoiceSession — that call
    // has to happen synchronously inside this tap handler, or the network
    // round trip for the Deepgram token breaks the gesture-context link
    // AgentPlayer needs to unlock iOS audio (voice-session.ts, §9 gotcha #1).
    setStatus("connecting");
    setTurns([]);

    void createVoiceSession(
      {
        onConversationText: handleConversationText,
        onAgentStartedSpeaking: () => setStatus("speaking"),
        onUserStartedSpeaking: () => setStatus("listening"),
        onDisconnected: () => {
          sessionRef.current = null;
          setStatus("idle");
        },
        onError: () => setStatus("error"),
      },
      { thinkEndpointUrl: new URL("/api/v1/agent/think", window.location.origin).toString() },
    )
      .then(async (session) => {
        sessionRef.current = session;
        await session.start();
        setStatus("listening");
      })
      .catch(() => setStatus("error"));
  }, [handleConversationText]);

  const toggle = useCallback(() => {
    if (status === "idle" || status === "error") {
      start();
    } else {
      stop();
    }
  }, [status, start, stop]);

  const sessionActive = status === "connecting" || status === "listening" || status === "speaking";

  return (
    <div className={styles.sheet}>
      <div className={styles.orb} data-active={sessionActive} />
      <div className={styles.listening}>{LABELS[status]}</div>

      <div className={styles.log}>
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
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <rect x="9" y="2.5" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0013 0" />
            <path d="M12 17.5V21" />
          </svg>
        </button>
        <div className={styles.micCap}>{sessionActive ? "Tap to end" : "Tap to start talking"}</div>
      </div>
    </div>
  );
}
