"use client";

import { useCallback, useRef, useState } from "react";
import { TranscriptionResponse } from "@headroom/contracts";
import { pickAudioMimeType } from "@/lib/media-format";
import styles from "./VoiceRecorder.module.css";

// Chunked-POST streaming, not a persistent connection — design doc §11 port
// rule 1 keeps /api/v1 route handlers as the only client<->server surface.
// The client resends the whole clip recorded so far every tick; the server
// re-transcribes it and returns its current best guess.
const RESEND_INTERVAL_MS = 1500;

type Status = "idle" | "recording" | "sending" | "saved" | "error";

export function VoiceRecorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const sendClip = useCallback(async (final: boolean) => {
    if (sendingRef.current) return;
    if (chunksRef.current.length === 0) return;

    sendingRef.current = true;
    try {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      const response = await fetch(`/api/v1/voice/transcriptions${final ? "?final=true" : ""}`, {
        method: "POST",
        headers: { "content-type": mimeTypeRef.current },
        body: blob,
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      const body = TranscriptionResponse.parse(await response.json());
      setTranscript(body.transcript);
      if (body.isFinal) setStatus("saved");
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "recording") return;

    setStatus("recording");
    setTranscript("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType((type) => MediaRecorder.isTypeSupported(type));
      if (mimeType) mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;

      intervalRef.current = setInterval(() => {
        void sendClip(false);
      }, RESEND_INTERVAL_MS);
    } catch {
      setStatus("error");
    }
  }, [sendClip, status]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setStatus("sending");
    recorder.addEventListener(
      "stop",
      () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        void sendClip(true);
      },
      { once: true },
    );
    recorder.stop();
  }, [sendClip]);

  const label =
    status === "recording"
      ? "Listening"
      : status === "sending"
        ? "Transcribing"
        : status === "saved"
          ? "Saved"
          : status === "error"
            ? "Something went wrong"
            : "Hold to talk";

  return (
    <div className={styles.sheet}>
      <div className={styles.orb} data-active={status === "recording"} />
      <div className={styles.listening}>{label}</div>
      <p className={styles.transcript}>{transcript || "…"}</p>
      <div className={styles.micLive}>
        <button
          type="button"
          className={styles.micLg}
          aria-pressed={status === "recording"}
          onPointerDown={() => void startRecording()}
          onPointerUp={stopRecording}
          onPointerLeave={() => status === "recording" && stopRecording()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <rect x="9" y="2.5" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0013 0" />
            <path d="M12 17.5V21" />
          </svg>
        </button>
        <div className={styles.micCap}>
          {status === "recording" ? "Release to send" : "Hold and speak"}
        </div>
      </div>
    </div>
  );
}
