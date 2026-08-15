"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CommitmentRow, TrackedPullRequestRow } from "@headroom/graph";
import { formatShortDate, isWithinDays, sourceLabel } from "@/lib/format";
import { isNeedsYou, isOnTrack, isWaitingOnOthers } from "@/lib/commitment-groups";
import { OttoNote } from "@/components/otto/OttoNote";
import { PendingList } from "@/components/otto/PendingList";
import { OpenPullRequestList } from "@/components/github/OpenPullRequestList";
import styles from "./CommitmentsView.module.css";

const WILL_APPEAR = [
  "Everything you owe, grouped overdue / this week / later",
  "Everything you're owed, and who's gone quiet on it",
  "What's already closed, and the evidence that closed it",
];

const SEGMENTS = ["All", "Needs you", "Waiting on others", "Done"] as const;
type Segment = (typeof SEGMENTS)[number];

const CLOSED_STATUSES = new Set(["fulfilled", "cancelled", "superseded", "rejected"]);

function matchesSegment(commitment: CommitmentRow, segment: Segment): boolean {
  const closed = CLOSED_STATUSES.has(commitment.status);
  switch (segment) {
    case "All":
      return !closed;
    case "Needs you":
      return isNeedsYou(commitment);
    case "Waiting on others":
      return isWaitingOnOthers(commitment);
    case "Done":
      return commitment.status === "fulfilled";
  }
}

function matchesSearch(commitment: CommitmentRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    commitment.summary,
    commitment.counterpartyPerson.displayName,
    sourceLabel(commitment.sourceArtifact.source),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function dueGroup(commitment: CommitmentRow): "Overdue" | "This week" | "Later" {
  if (commitment.status === "overdue") return "Overdue";
  if (commitment.dueAt && isWithinDays(commitment.dueAt, 7)) return "This week";
  return "Later";
}

function dotColor(commitment: CommitmentRow): string {
  if (commitment.status === "overdue") return "red";
  if (commitment.status === "at_risk") return "amber";
  if (commitment.direction === "owed_to_me" && commitment.status === "open") return "gray";
  return "green";
}

export function CommitmentsView({
  commitments,
  openPullRequests,
}: {
  commitments: CommitmentRow[];
  openPullRequests: TrackedPullRequestRow[];
}) {
  const [segment, setSegment] = useState<Segment>("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const open = commitments.filter((c) => !CLOSED_STATUSES.has(c.status));
    return {
      open: open.length,
      needsYou: open.filter((c) => matchesSegment(c, "Needs you")).length,
      onTrack: open.filter(isOnTrack).length,
      waiting: open.filter((c) => matchesSegment(c, "Waiting on others")).length,
    };
  }, [commitments]);

  const visible = useMemo(
    () => commitments.filter((c) => matchesSegment(c, segment) && matchesSearch(c, query)),
    [commitments, segment, query],
  );

  const groups: Array<{ label: "Overdue" | "This week" | "Later"; items: CommitmentRow[] }> =
    segment === "Done"
      ? [{ label: "Later", items: visible }]
      : (["Overdue", "This week", "Later"] as const)
          .map((label) => ({ label, items: visible.filter((c) => dueGroup(c) === label) }))
          .filter((group) => group.items.length > 0);

  return (
    <main className={styles.screen}>
      <div className={styles.eyebrow}>Commitments</div>
      <div className={styles.display}>
        {commitments.length > 0
          ? `${counts.open} open.`
          : openPullRequests.length > 0
            ? // Something *was* read — it just isn't owed in either direction.
              "Nothing owed either way."
            : "Nothing to track yet."}
      </div>
      {counts.open > 0 && (
        <div className={styles.sub}>
          {counts.needsYou} need you. {counts.onTrack} on track. {counts.waiting} waiting on someone else.
        </div>
      )}

      {commitments.length === 0 ? (
        <>
          <OpenPullRequestList pullRequests={openPullRequests} />
          {openPullRequests.length === 0 ? (
            <>
              <OttoNote action={{ label: "Connect a source", href: "/controls" }}>
                This fills up on its own. You never type a promise in here &mdash; I read them from
                wherever you actually made them, and every one keeps a link back to the original.
              </OttoNote>
              <PendingList title="Once I've read something" items={WILL_APPEAR} />
            </>
          ) : (
            <OttoNote action={{ label: "Connect a source", href: "/controls" }}>
              Those are yours alone &mdash; nobody has been asked to review them, so nothing is owed
              in either direction yet. Commitments appear here once I can see two people and a
              promise between them.
            </OttoNote>
          )}
        </>
      ) : (
        <>
          <div className={styles.search}>
            <input
              type="text"
              placeholder="Search people, promises, sources"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className={styles.segs}>
            {SEGMENTS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.seg}
                data-on={s === segment}
                onClick={() => setSegment(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className={styles.empty}>No commitments match.</div>
          ) : (
            groups.map((group) => (
              <div className={styles.grp} key={group.label}>
                <div className={styles.grpHead}>
                  <div className={styles.eyebrow} data-tone={group.label === "Overdue" ? "red" : undefined}>
                    {group.label}
                  </div>
                  <div className={styles.count}>{group.items.length}</div>
                </div>
                {group.items.map((c) => (
                  <Link href={`/commitments/${c.id}`} className={styles.crow} key={c.id}>
                    <div className={styles.cdot} data-color={dotColor(c)} />
                    <div className={styles.t}>
                      <b>{c.summary}</b>
                      <em>
                        {c.counterpartyPerson.displayName} · {sourceLabel(c.sourceArtifact.source)}
                      </em>
                    </div>
                    <div className={styles.r}>{c.dueAt ? formatShortDate(c.dueAt) : "—"}</div>
                    <svg
                      className={styles.chev}
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            ))
          )}

          {/* Outside the segment/search filtering above on purpose: those
              segments partition commitments by direction and status, and a PR
              with neither can't be filtered by them honestly. */}
          <OpenPullRequestList pullRequests={openPullRequests} />
        </>
      )}
    </main>
  );
}
