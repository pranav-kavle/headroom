import styles from "./Landing.module.css";
import { MockCard } from "./MockCard";
import { SignUpCta } from "./SignUpCta";

export function Hero() {
  return (
    <div className={styles.lpHero}>
      <div>
        <div className={styles.lpEyebrow}>For Schedule C freelancers</div>
        <h1 className="serif">
          Know exactly how much you can <em>pay yourself.</em> Every week.
        </h1>
        <p className={styles.lpSub}>
          Irregular income. Quarterly tax dread. The one question you can never
          quite answer: <b>can I afford to pay myself this month?</b> Cashflow
          Companion answers it — and defends the number.
        </p>
        <div className={styles.lpCta}>
          <SignUpCta className="btn primary lg">Connect your bank</SignUpCta>
        </div>
      </div>
      <MockCard />
    </div>
  );
}
