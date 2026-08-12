"use client";

import { useState } from "react";
import { VoiceFab } from "./VoiceFab";
import { VoiceSheet } from "./VoiceSheet";
import { VoiceRecorder } from "./VoiceRecorder";

export function VoiceOverlay() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <VoiceFab onOpen={() => setOpen(true)} />
      {open && (
        <VoiceSheet onClose={() => setOpen(false)}>
          <VoiceRecorder />
        </VoiceSheet>
      )}
    </>
  );
}
