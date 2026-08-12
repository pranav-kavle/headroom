import styles from "./Landing.module.css";

export function LandingFooter() {
  return (
    <div className={styles.lpFoot}>
      <div className={styles.lpInner}>
        <span>Early build · reads your accounts, drafts on your behalf, sends nothing without a tap.</span>
        <span>Every claim links back to the message it came from.</span>
      </div>
    </div>
  );
}
