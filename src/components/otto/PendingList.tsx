import styles from "./PendingList.module.css";

/**
 * The placeholder for a surface that is built but has nothing to fill it, or a
 * capability that isn't built at all. Greyed and dashed so it reads as "not
 * yet" rather than as content — an empty screen should still say what it is
 * for.
 */
export function PendingList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item}>
            <i className={styles.pending} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
