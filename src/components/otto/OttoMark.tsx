import styles from "./OttoMark.module.css";

/**
 * Otto's mark: the Headroom mark rounded off — same two bars, circle instead of
 * square. The assistant is of the product, not a second brand.
 */
export function OttoMark({ size = "lg" }: { size?: "lg" | "sm" }) {
  return <i className={styles.mark} data-size={size} aria-hidden="true" />;
}
