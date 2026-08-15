import Link from "next/link";
import type { CommitmentRow, TrackedPullRequestRow } from "@headroom/graph";
import type { CapacityTile } from "@/lib/capacity";
import { CapacityTiles } from "@/components/brief/CapacityTiles";
import { isNeedsYou, isOnTrack, isWaitingOnOthers } from "@/lib/commitment-groups";
import { STATUS_LABELS, pillTone } from "@/lib/commitment-status";
import { formatShortDate, sourceLabel } from "@/lib/format";
import { formatDateLabel, timeOfDayGreeting } from "@/lib/greeting";
import { OttoNote } from "@/components/otto/OttoNote";
import { PendingList } from "@/components/otto/PendingList";
import { OpenPullRequestList } from "@/components/github/OpenPullRequestList";
import styles from "./BriefView.module.css";

const ON_TRACK_VISIBLE = 3;

const WILL_APPEAR = [
  "Promises you've made, with the quote you made them in",
  "What's at risk, and why — before it's late",
  "What you're owed, and who's gone quiet",
];

// Say what was actually read, rather than counting zeroes. Reaching this line
// means at least one of the three lists has something in it, so each case
// below names the most substantial thing that landed.
function subLine(counts: {
  commitments: number;
  onTrack: number;
  waiting: number;
  openPullRequests: number;
}): string {
  if (counts.commitments > 0) {
    return `${counts.onTrack} on track. ${counts.waiting} waiting on others.`;
  }
  if (counts.openPullRequests > 0) {
    const plural = counts.openPullRequests === 1 ? "" : "s";
    return `${counts.openPullRequests} open PR${plural} of your own, owed to no one yet.`;
  }
  // Only capacity has synced — reporting "0 open PRs" here would be technically
  // true and completely uninformative.
  return "Capacity readings so far. No promises read yet.";
}

export function BriefView({
  commitments,
  openPullRequests,
  capacityTiles,
  name,
  timeZone,
}: {
  commitments: CommitmentRow[];
  openPullRequests: TrackedPullRequestRow[];
  capacityTiles: CapacityTile[];
  name: string;
  timeZone: string | null;
}) {
  // An empty graph is the *normal* first state, not an error — so it greets
  // you, says plainly that it hasn't read anything, and offers the one action
  // that changes that.
  //
  // Every list has to be empty to count as "read nothing": your own open PRs
  // are real read facts even though none of them is a commitment, and showing
  // "I haven't read anything yet" above a PR list would be a plain lie. Synced
  // capacity readings are read facts by the same measure, so they count too.
  if (commitments.length === 0 && openPullRequests.length === 0 && capacityTiles.length === 0) {
    const now = new Date();
    return (
      <main className={styles.screen}>
        <div className={styles.eyebrow}>{formatDateLabel(now, timeZone)}</div>
        <div className={styles.display}>
          {timeOfDayGreeting(now, timeZone)}, {name}.
        </div>
        <div className={styles.sub}>Nothing to report &mdash; I haven&rsquo;t read anything yet.</div>

        <OttoNote action={{ label: "Connect a source", href: "/controls" }}>
          Give me a source and I&rsquo;ll go looking. Gmail is where most promises actually get
          made &mdash; it takes about five minutes to read your last 90 days.
        </OttoNote>

        <PendingList title="What'll show up here" items={WILL_APPEAR} />
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
        {subLine({
          commitments: commitments.length,
          onTrack: onTrack.length,
          waiting: waiting.length,
          openPullRequests: openPullRequests.length,
        })}
      </div>

      <CapacityTiles tiles={capacityTiles} />

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

      {/* Suppressed when there are no commitments at all: an empty "On track 0"
          box above a list of PRs reads as a rendering fault, not as calm. */}
      {commitments.length > 0 && (
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
      )}

      <OpenPullRequestList pullRequests={openPullRequests} />
    </main>
  );
}
