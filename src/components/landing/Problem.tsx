import styles from "./Landing.module.css";

export function Problem() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>The problem</div>
        <h2 className="serif">When income is irregular, every dollar is contested.</h2>
        <p className={styles.lead}>
          A retainer here, an invoice that lands three weeks late there. Meanwhile
          taxes, a runway floor, your own pay, savings and debt are all pulling at
          the same balance. Guess high and you claw it back next month; guess low
          and you underpay yourself all year. <b>Allocation collapses under
          uncertainty</b> — so the honest answer to “how much can I pay myself?” is
          usually “I don’t know.”
        </p>
      </div>
    </div>
  );
}
