import Link from "next/link";
import styles from "./BottomTabBar.module.css";

const TABS = [
  { id: "brief", label: "Brief", href: "/brief", icon: <path d="M4 6h16M4 12h11M4 18h7" /> },
  {
    id: "commitments",
    label: "Commitments",
    href: "/commitments",
    icon: (
      <>
        <path d="M9 11l2.5 2.5L16 8" />
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      </>
    ),
  },
  {
    id: "ledger",
    label: "Ledger",
    href: "/ledger",
    icon: (
      <>
        <path d="M12 7v5l3.5 2" />
        <circle cx="12" cy="12" r="8.5" />
      </>
    ),
  },
  {
    id: "controls",
    label: "Controls",
    href: "/controls",
    // Sliders, not a gear: this screen is where you decide what Headroom may
    // do on its own, which is closer to tuning than to configuring.
    icon: (
      <>
        <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
        <circle cx="16" cy="8" r="2" />
        <circle cx="10" cy="16" r="2" />
      </>
    ),
  },
] as const;

export type TabId = (typeof TABS)[number]["id"];

// All three tabs are real destinations — `active` highlights whichever one
// hosts this bar.
export function BottomTabBar({ active }: { active?: TabId } = {}) {
  return (
    <div className={styles.bar}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} className={styles.tab} data-active={tab.id === active}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
            {tab.icon}
          </svg>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
