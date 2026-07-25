import styles from "./Landing.module.css";
import { SignUpCta } from "./SignUpCta";

export function FeatureCards() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.lpTwo}>
          <div className={styles.featureCard}>
            <div className={styles.secEyebrow}>The AI-hard part</div>
            <h3>Real income is messy.</h3>
            <p>
              A Zelle payment with the memo “inv” could be a client invoice or your
              roommate paying rent. The engine won’t bank it until the model reads
              the evidence and you confirm.
            </p>
            <div className={styles.miniTxn}>
              <div className={styles.amt}>$4,200 · Zelle from J. Rivera</div>
              <div className={styles.q}>memo “inv” — client income or personal?</div>
              <div className={styles.miniConf}>
                <i />
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, fontFamily: "var(--font-tabular)" }}>
                confidence 61% · escalated for confirm
              </div>
            </div>
          </div>
          <div className={`${styles.featureCard} ${styles.amber}`}>
            <div className={styles.secEyebrow} style={{ color: "var(--amber)" }}>The catch</div>
            <h3>It sees the shortfall weeks early.</h3>
            <p>
              When Acme’s $5,000 invoice slips 30 days, Headroom catches
              the tax-and-runway squeeze before it lands — lowers your Safe-to-Pay
              to a number you can trust, and protects the floors first.
            </p>
            <div style={{ marginTop: 20 }}>
              <SignUpCta className="btn primary">See the catch →</SignUpCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
