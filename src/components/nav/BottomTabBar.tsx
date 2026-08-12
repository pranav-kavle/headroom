import styles from "./BottomTabBar.module.css";

const TABS = [
  { id: "brief", label: "Brief", icon: <path d="M4 6h16M4 12h11M4 18h7" /> },
  {
    id: "commitments",
    label: "Commitments",
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
    icon: (
      <>
        <path d="M12 7v5l3.5 2" />
        <circle cx="12" cy="12" r="8.5" />
      </>
    ),
  },
] as const;

export type TabId = (typeof TABS)[number]["id"];

// Brief/Commitments/Ledger aren't built yet — every tab renders disabled
// until each has a real destination. `active` is here for when they do.
export function BottomTabBar({ active }: { active?: TabId } = {}) {
  return (
    <div className={styles.bar}>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          className={styles.tab}
          data-active={tab.id === active}
          aria-disabled="true"
          title="Coming soon"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
            {tab.icon}
          </svg>
          {tab.label}
        </div>
      ))}
    </div>
  );
}
