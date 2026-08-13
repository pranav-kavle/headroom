"use client";

import { useCallback, useEffect, useState } from "react";
import { VoiceFab } from "./VoiceFab";
import { VoiceSheet } from "./VoiceSheet";
import { VoiceRecorder } from "./VoiceRecorder";

export function VoiceOverlay() {
  const [open, setOpen] = useState(false);

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

    const onPopState = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, requestClose]);

  return (
    <>
      <VoiceFab onOpen={() => setOpen(true)} />
      {open && (
        <VoiceSheet onClose={requestClose}>
          <VoiceRecorder />
        </VoiceSheet>
      )}
    </>
  );
}
