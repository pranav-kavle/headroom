import styles from "./Landing.module.css";
import { WarnIcon } from "./icons";

export function MockCard() {
  return (
    <div className={styles.lpMock}>
      <div className={styles.float}>
        <div className={styles.mockCard}>
          <span className={styles.mockBadge}>
            <WarnIcon /> The catch
          </span>
          <div className={styles.mockLbl}>Safe-to-Pay this period</div>
          <div className={`${styles.mockNum} mono`}>$3,650</div>
          <div className={styles.mockRange}>
            Range <b className="mono">$3,650–$5,050</b> · conservative end shown
          </div>
          <div className={styles.mockFoot}>
            <span className={styles.hpill}>Taxes funded</span>
            <span className={styles.hpill}>Floor $6,000</span>
            <span className={styles.hpill}>Schedule C · CA</span>
          </div>
        </div>
        <div className={styles.mockChip}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", fontWeight: 700 }}>
            Reads &amp; recommends
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
            Never moves your money.
          </div>
        </div>
      </div>
    </div>
  );
}
