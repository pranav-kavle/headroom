import styles from "./AppFrame.module.css";

// Every prototype screen is a 390px phone frame — this is that frame for
// the real app, so /voice and /account read as a mobile app rather than a
// full-width website, matching the sign-up page's existing max-width card.
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.outer}>
      <div className={styles.frame}>{children}</div>
    </div>
  );
}
