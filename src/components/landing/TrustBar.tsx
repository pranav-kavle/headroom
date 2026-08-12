import styles from "./Landing.module.css";
import { ShieldIcon, FileIcon, DocIcon } from "./icons";

export function TrustBar() {
  return (
    <div className={styles.lpTrust}>
      <div className={styles.lpInner}>
        <div className={styles.trustItem}>
          <ShieldIcon />
          <div>
            <div className={styles.tk}>It drafts. You send.</div>
            <div className={styles.tv}>Anything outward-facing is one tap, always. That isn&rsquo;t a setting you can switch off.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <FileIcon />
          <div>
            <div className={styles.tk}>Every claim carries its receipt.</div>
            <div className={styles.tv}>A commitment is only shown if it traces to a real message — the quote, the timestamp, and a link back.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <DocIcon />
          <div>
            <div className={styles.tk}>The engine computes. The model phrases.</div>
            <div className={styles.tv}>No date, count, or score is ever invented by a language model.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
