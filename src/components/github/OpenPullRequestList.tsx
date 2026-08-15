import type { TrackedPullRequestRow } from "@headroom/graph";
import { formatShortDate } from "@/lib/format";
import styles from "./OpenPullRequestList.module.css";

/**
 * Your own open PRs that no commitment covers.
 *
 * Deliberately its own section rather than a row among the commitments: a PR
 * with no requested reviewer has no counterparty and no direction, so it can't
 * be grouped as "needs you" or "waiting on others" without inventing one of
 * them. It is a fact about your work, not a promise between two people.
 *
 * Links out to GitHub rather than to a detail route, because there is no
 * commitment to open — the artifact's own url is the provenance.
 */
export function OpenPullRequestList({ pullRequests }: { pullRequests: TrackedPullRequestRow[] }) {
  if (pullRequests.length === 0) return null;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Your open PRs</h2>
        <div className={styles.count}>{pullRequests.length}</div>
      </div>
      <div className={styles.list}>
        {pullRequests.map((pr) => (
          <a
            key={pr.id}
            className={styles.item}
            href={pr.artifact.url ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            <div className={styles.itemTop}>
              <div className={styles.itemTitle}>{pr.artifact.excerpt}</div>
              <div className={styles.num}>#{pr.number}</div>
            </div>
            <div className={styles.meta}>
              Opened {formatShortDate(pr.artifact.occurredAt)} · no reviewer requested
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
