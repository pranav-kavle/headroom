import styles from "./Landing.module.css";
import { SignUpCta } from "./SignUpCta";

export function FeatureCards() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.lpTwo}>
          <div className={styles.featureCard}>
            <div className={styles.secEyebrow}>The AI-hard part</div>
            <h3>Promises don&rsquo;t announce themselves.</h3>
            <p>
              &ldquo;I&rsquo;ll get you the draft by Thursday,&rdquo; buried in the fourth
              paragraph of a thread, is a commitment. &ldquo;I&rsquo;ll take a look&rdquo;
              is not. Headroom won&rsquo;t record one until it can quote the sentence it
              came from — and when it isn&rsquo;t sure, it asks.
            </p>
            <div className={styles.miniTxn}>
              <div className={styles.amt}>&ldquo;I&rsquo;ll send the revised deck Thursday&rdquo;</div>
              <div className={styles.q}>thread with Maya R. — is this a commitment?</div>
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
            <h3>It sees the crunch before you do.</h3>
            <p>
              Thursday has three deliverables and four hours of meetings booked over them.
              Headroom flags the collision on Monday, while it&rsquo;s still fixable — and
              tells you which promise to move, not just that you&rsquo;re busy.
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
