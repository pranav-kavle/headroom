import Link from "next/link";
import type { CommitmentRow } from "@headroom/graph";
import { isNeedsYou, isOnTrack, isWaitingOnOthers } from "@/lib/commitment-groups";
import { STATUS_LABELS, pillTone } from "@/lib/commitment-status";
import { formatShortDate, sourceLabel } from "@/lib/format";
import styles from "./BriefView.module.css";

const ON_TRACK_VISIBLE = 3;

export function BriefView({ commitments }: { commitments: CommitmentRow[] }) {
  if (commitments.length === 0) {
    return (
      <main className={styles.screen}>
        <div className={styles.eyebrow}>Brief</div>
        <div className={styles.display}>Nothing here yet.</div>
        <div className={styles.empty}>
          Headroom hasn&rsquo;t found any commitments to track yet.
        </div>
      </main>
    );
  }

  const needsYou = commitments.filter(isNeedsYou);
  const onTrack = commitments.filter(isOnTrack);
  const waiting = commitments.filter(isWaitingOnOthers);
  const visibleOnTrack = onTrack.slice(0, ON_TRACK_VISIBLE);
  const moreOnTrack = onTrack.length - visibleOnTrack.length;

  return (
    <main className={styles.screen}>
      <div className={styles.eyebrow}>Brief</div>
      <div className={styles.display}>
        {needsYou.length === 0
          ? "Nothing at risk."
          : `${needsYou.length} promise${needsYou.length === 1 ? "" : "s"} need${needsYou.length === 1 ? "s" : ""} you.`}
      </div>
      <div className={styles.sub}>
        {onTrack.length} on track. {waiting.length} waiting on others.
      </div>

      {needsYou.length > 0 && (
        <div className={styles.grp}>
          <div className={styles.secHead}>
            <div className={styles.eyebrow}>Needs you</div>
            <div className={styles.count}>{needsYou.length}</div>
          </div>
          {needsYou.map((c) => (
            <Link href={`/commitments/${c.id}`} className={styles.item} key={c.id}>
              <div className={styles.itemTop}>
                <div className={styles.itemTitle}>{c.summary}</div>
                <div className={styles.pill} data-tone={pillTone(c.status)}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </div>
              </div>
              <div className={styles.meta}>
                {c.counterpartyPerson.displayName} · {sourceLabel(c.sourceArtifact.source)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.grp}>
        <div className={styles.secHead}>
          <div className={styles.eyebrow}>On track</div>
          <div className={styles.count}>{onTrack.length}</div>
        </div>
        <div className={styles.ontrack}>
          {visibleOnTrack.map((c) => (
            <div className={styles.otRow} key={c.id}>
              <div className={styles.tick}>
                <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </div>
              <span>{c.summary}</span>
              <em>{c.dueAt ? formatShortDate(c.dueAt) : "—"}</em>
            </div>
          ))}
          {moreOnTrack > 0 && (
            <Link href="/commitments" className={styles.otMore}>
              Show {moreOnTrack} more
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
