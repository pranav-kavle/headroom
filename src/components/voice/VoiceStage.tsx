import styles from "./VoiceStage.module.css";

/**
 * The full-frame surface voice runs on, replacing the bottom sheet.
 *
 * The sheet gave the transcript roughly 40% of a capped 640px box, with the
 * rest spent on an orb and a mic button. Since the transcript is where the
 * evidence lives — and evidence is what licenses anything the agent says
 * (core rule 2) — it gets the frame instead.
 *
 * Sized to the app frame rather than the viewport so it lines up with the
 * 390px column AppFrame establishes, instead of stretching across a desktop
 * window while the app behind it stays narrow.
 */
export function VoiceStage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.outer} role="dialog" aria-modal="true" aria-label="Voice">
      <div className={styles.frame}>{children}</div>
    </div>
  );
}
