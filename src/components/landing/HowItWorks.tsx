import styles from "./Landing.module.css";

export function HowItWorks() {
  return (
    <section id="how" className={`${styles.lpSec} ${styles.tint}`}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>How it works</div>
        <h2 className="serif">One question, answered continuously.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.sn}>1</div>
            <h3>Connect &amp; classify</h3>
            <p>It reads your bank data and classifies real income — even the messy deposits. Unsure ones come to you for a one-tap confirm.</p>
            <span className={styles.tag}>AI · judgment</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>2</div>
            <h3>Solve the waterfall</h3>
            <p>A deterministic engine owns the math: taxes, then runway floor, then pay, then savings, then debt. Same inputs, same answer — every time.</p>
            <span className={styles.tag}>Engine · arithmetic</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>3</div>
            <h3>Re-plan &amp; surface one thing</h3>
            <p>It re-plans in the background as reality changes and surfaces the single decision worth your attention — or stays silent.</p>
            <span className={styles.tag}>Earned attention</span>
          </div>
        </div>
      </div>
    </section>
  );
}
