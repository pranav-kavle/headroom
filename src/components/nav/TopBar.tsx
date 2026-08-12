import Link from "next/link";
import styles from "./TopBar.module.css";

// Only pushed screens have a top bar. The four tab screens lead with their own
// headline instead, so there is no chrome above it.
export function TopBar({ label, href }: { label: string; href: string }) {
  return (
    <div className={styles.bar}>
      <Link href={href} className={styles.backButton}>
        <svg
          viewBox="0 0 24 24"
          width="19"
          height="19"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.3}
          strokeLinecap="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
        {label}
      </Link>
    </div>
  );
}
