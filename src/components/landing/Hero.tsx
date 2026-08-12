import styles from "./Landing.module.css";
import { MockCard } from "./MockCard";
import { SignUpCta } from "./SignUpCta";

export function Hero() {
  return (
    <div className={styles.lpHero}>
      <div>
        <div className={styles.lpEyebrow}>For people who owe more people than they can track</div>
        <h1 className="serif">
          Know what you actually <em>owe.</em> Before it&rsquo;s late.
        </h1>
        <p className={styles.lpSub}>
          Every commitment you&rsquo;ve made lives in a different app, and none of them know
          how much you have left in the tank. Headroom reads your email, GitHub and
          calendar, extracts every promise{" "}
          <b>with a citation to exactly where you made it</b>, and tells you each morning
          what&rsquo;s actually at risk.
        </p>
        <div className={styles.lpCta}>
          <SignUpCta className="btn primary lg">Connect your accounts</SignUpCta>
        </div>
      </div>
      <MockCard />
    </div>
  );
}
