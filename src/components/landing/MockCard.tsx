import styles from "./Landing.module.css";
import { WarnIcon } from "./icons";

export function MockCard() {
  return (
    <div className={styles.lpMock}>
      <div className={styles.float}>
        <div className={styles.mockCard}>
          <span className={styles.mockBadge}>
            <WarnIcon /> Needs you
          </span>
          <div className={styles.mockLbl}>At risk today</div>
          <div className={`${styles.mockNum} mono`}>2</div>
          <div className={styles.mockRange}>
            of <b className="mono">14</b> open commitments · every one quoted from source
          </div>
          <div className={styles.mockFoot}>
            <span className={styles.hpill}>Gmail</span>
            <span className={styles.hpill}>GitHub</span>
            <span className={styles.hpill}>Calendar</span>
          </div>
        </div>
        <div className={styles.mockChip}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", fontWeight: 700 }}>
            Reads &amp; drafts
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
            Nothing sends without your tap.
          </div>
        </div>
      </div>
    </div>
  );
}
