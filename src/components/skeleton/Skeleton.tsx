import styles from "./Skeleton.module.css";

export { styles as skeletonStyles };

// A single shimmering placeholder block. Sizes are passed as CSS lengths so
// each screen's skeleton can mirror the shape of the content it stands in for.
export function Skeleton({
  w,
  h,
  circle = false,
  radius,
}: {
  w?: string;
  h: string;
  circle?: boolean;
  radius?: string;
}) {
  return (
    <span
      className={circle ? `${styles.block} ${styles.circle}` : styles.block}
      style={{ width: w ?? "100%", height: h, borderRadius: radius }}
    />
  );
}

// The scroll area of a loading screen. `role="status"` + the visually hidden
// label are what a screen reader gets; the blocks themselves are decorative.
export function SkeletonScreen({
  children,
  tight = false,
  label = "Loading",
}: {
  children: React.ReactNode;
  tight?: boolean;
  label?: string;
}) {
  return (
    <main
      className={tight ? `${styles.screen} ${styles.screenTight}` : styles.screen}
      role="status"
      aria-busy="true"
    >
      <span className={styles.sr}>{label}</span>
      {children}
    </main>
  );
}

// Eyebrow + headline + subhead, the shared top of Brief / Commitments / Ledger.
export function SkeletonHeader() {
  return (
    <div className={styles.head}>
      <Skeleton w="52px" h="11px" />
      <div style={{ height: 13 }} />
      <Skeleton w="85%" h="25px" />
      <div style={{ height: 8 }} />
      <Skeleton w="55%" h="25px" />
      <div style={{ height: 14 }} />
      <Skeleton w="62%" h="14px" />
    </div>
  );
}

// One list row: leading dot, two lines of text, trailing meta.
export function SkeletonRow({ titleWidth = "72%" }: { titleWidth?: string }) {
  return (
    <div className={styles.row}>
      <Skeleton w="7px" h="7px" circle />
      <span className={styles.rowText}>
        <Skeleton w={titleWidth} h="14px" />
        <Skeleton w="45%" h="11px" />
      </span>
      <Skeleton w="34px" h="11px" />
    </div>
  );
}
