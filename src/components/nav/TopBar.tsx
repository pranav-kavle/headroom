import Link from "next/link";
import styles from "./TopBar.module.css";

type TopBarProps =
  | { variant: "back"; label: string; href: string }
  | { variant: "home"; initials: string; accountHref: string };

export function TopBar(props: TopBarProps) {
  if (props.variant === "back") {
    return (
      <div className={styles.bar}>
        <Link href={props.href} className={styles.backButton}>
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
          {props.label}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <div className={styles.spacer} />
      <Link href={props.accountHref} className={styles.avatar} aria-label="Account">
        {props.initials}
      </Link>
    </div>
  );
}
