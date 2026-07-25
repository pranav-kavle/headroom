import styles from "./Landing.module.css";

export function LandingFooter() {
  return (
    <div className={styles.lpFoot}>
      <div className={styles.lpInner}>
        <span>Demo build · scripted data. No money moves. Read &amp; recommend only.</span>
        <span>Estimates — confirm with your accountant.</span>
      </div>
    </div>
  );
}
