"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentCitation, AgentTurnCitationsResponse } from "@headroom/contracts";
import { createVoiceSession, type VoiceSession } from "@/lib/voice-session";
import { VoiceFab } from "./VoiceFab";
import { VoiceSheet } from "./VoiceSheet";
import { VoiceRecorder, type VoiceStatus, type VoiceTurn } from "./VoiceRecorder";

async function fetchLatestCitations(): Promise<AgentCitation[]> {
  // §6: citations for a turn are produced inside /api/v1/agent/think and
  // never travel over Deepgram's socket, so they're fetched separately
  // rather than read off the conversation-text event.
  const response = await fetch("/api/v1/agent/think/citations");
  if (!response.ok) return [];
  return AgentTurnCitationsResponse.parse(await response.json()).citations;
}

export function VoiceOverlay() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  // Bug 9/10: distinguishes *why* status is "error" — token/connect failure,
  // a live SDK error, or an unexpected mid-session drop — rather than
  // collapsing all three into one generic "Something went wrong".
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const sessionRef = useRef<VoiceSession | null>(null);
  // Guards the async gap in start() below — connect() is in flight while
  // status is "connecting" and sessionRef is still null, so a stop() called
  // in that window can't reach a session yet. Without this flag the
  // in-flight .then() resolves afterwards regardless and resurrects the
  // session the user already tried to exit.
  const cancelledRef = useRef(false);

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
    cancelledRef.current = true;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    // Deliberately not awaited before calling createVoiceSession — that call
    // has to happen synchronously inside the tap handler that triggers it
    // (see openAndStart below), or the network round trip for the Deepgram
    // token breaks the gesture-context link AgentPlayer needs to unlock iOS
    // audio (voice-session.ts, §9 gotcha #1).
    cancelledRef.current = false;
    setStatus("connecting");
    setErrorMessage(undefined);
    setTurns([]);

    void createVoiceSession(
      {
        onConversationText: handleConversationText,
        onAgentStartedSpeaking: () => setStatus("speaking"),
        onUserStartedSpeaking: () => setStatus("listening"),
        onDisconnected: () => {
          sessionRef.current = null;
          // cancelledRef is only set ahead of a deliberate stop() — a
          // disconnect that shows up without it means the connection dropped
          // on its own, which deserves a message rather than silently
          // resetting to idle as if nothing happened.
          if (cancelledRef.current) {
            setStatus("idle");
          } else {
            setErrorMessage("Connection dropped. Tap to reconnect.");
            setStatus("error");
          }
        },
        onError: () => {
          setErrorMessage("Lost connection to the voice agent. Tap to try again.");
          setStatus("error");
        },
      },
      { thinkEndpointUrl: new URL("/api/v1/agent/think", window.location.origin).toString() },
    )
      .then(async (session) => {
        if (cancelledRef.current) {
          session.stop();
          return;
        }
        sessionRef.current = session;
        await session.start();
        if (cancelledRef.current) {
          session.stop();
          sessionRef.current = null;
          return;
        }
        setStatus("listening");
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setErrorMessage("Could not start a voice session. Check your connection and try again.");
          setStatus("error");
        }
      });
  }, [handleConversationText]);

  const toggle = useCallback(() => {
    if (status === "idle" || status === "error") {
      start();
    } else {
      stop();
    }
  }, [status, start, stop]);

  // Single tap: open the sheet and start listening in the same gesture. Has
  // to call start() synchronously here, before the sheet (and VoiceRecorder)
  // ever mounts — deferring the session creation to an effect after mount
  // would run outside the tap's call stack and lose the same iOS
  // gesture-context link described in start() above.
  const openAndStart = useCallback(() => {
    setOpen(true);
    start();
  }, [start]);

  // Opening pushes a history entry so the OS back gesture/hardware back
  // button (this is a standalone-display PWA — no browser chrome to fall
  // back on) has something voice-specific to pop. Every close path funnels
  // through history.back() rather than setOpen(false) directly, so the
  // popstate listener below is the single place that flips `open` off.
  const requestClose = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ voiceSheet: true }, "");

    const onPopState = () => {
      setOpen(false);
      stop();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, requestClose, stop]);

  // Covers the overlay itself unmounting (e.g. a route change) while a
  // session is still active — the popstate path above only covers the sheet
  // closing on its own page.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  return (
    <>
      <VoiceFab onOpen={openAndStart} />
      {open && (
        <VoiceSheet onClose={requestClose}>
          <VoiceRecorder status={status} errorMessage={errorMessage} turns={turns} onToggleMic={toggle} />
        </VoiceSheet>
      )}
    </>
  );
}
