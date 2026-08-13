import styles from "./VoiceSheet.module.css";

export function VoiceSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close voice capture" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.grab} />
        <button type="button" className={styles.close} aria-label="Close voice capture" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}
