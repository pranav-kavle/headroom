import styles from "./VoiceFab.module.css";

export function VoiceFab({ onOpen }: { onOpen: () => void }) {
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} aria-label="Open voice capture" onClick={onOpen}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0013 0" />
          <path d="M12 17.5V21" />
        </svg>
      </button>
      <div className={styles.hint}>Hold</div>
    </div>
  );
}
