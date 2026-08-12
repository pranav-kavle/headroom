import styles from "./Landing.module.css";

export function HowItWorks() {
  return (
    <section id="how" className={`${styles.lpSec} ${styles.tint}`}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>How it works</div>
        <h2 className="serif">Read, weigh, and surface only what needs you.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.sn}>1</div>
            <h3>Read &amp; extract</h3>
            <p>It reads your email, GitHub and calendar and pulls out every promise you made — each one quoted from where you actually made it. Unsure ones come to you for a one-tap confirm.</p>
            <span className={styles.tag}>AI · judgment</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>2</div>
            <h3>Weigh against capacity</h3>
            <p>A deterministic engine owns the arithmetic: hours promised against hours free, what&rsquo;s due when, and what&rsquo;s blocking what. Same inputs, same answer — every time.</p>
            <span className={styles.tag}>Engine · arithmetic</span>
          </div>
          <div className={styles.step}>
            <div className={styles.sn}>3</div>
            <h3>Surface what&rsquo;s at risk</h3>
            <p>Each morning it surfaces only the commitments that need you, with the reply already drafted — or it stays quiet.</p>
            <span className={styles.tag}>Earned attention</span>
          </div>
        </div>
      </div>
    </section>
  );
}
