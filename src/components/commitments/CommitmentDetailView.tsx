import type { CommitmentRow } from "@headroom/graph";
import { TopBar } from "@/components/nav/TopBar";
import { sourceLabel } from "@/lib/format";
import styles from "./CommitmentDetailView.module.css";

const STATUS_LABELS: Record<string, string> = {
  open: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
  fulfilled: "Done",
  cancelled: "Cancelled",
  superseded: "Superseded",
  rejected: "Rejected",
};

function pillTone(status: string): string {
  if (status === "overdue") return "red";
  if (status === "at_risk") return "amber";
  return "green";
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function CommitmentDetailView({ commitment }: { commitment: CommitmentRow }) {
  const who =
    commitment.direction === "owed_by_me"
      ? `You promised ${commitment.counterpartyPerson.displayName}`
      : `${commitment.counterpartyPerson.displayName} promised you`;

  return (
    <>
      <TopBar variant="back" label="Commitments" href="/commitments" />
      <main className={styles.screen}>
        <div className={styles.pill} data-tone={pillTone(commitment.status)}>
          {STATUS_LABELS[commitment.status] ?? commitment.status}
        </div>
        <div className={styles.display}>{commitment.summary}</div>
        <div className={styles.who}>
          <div className={styles.av}>{initials(commitment.counterpartyPerson.displayName)}</div>
          <div className={styles.whoName}>{who}</div>
        </div>

        <div className={styles.block}>
          <div className={styles.eyebrow}>Evidence</div>
          <div className={styles.quote}>&ldquo;{commitment.quote}&rdquo;</div>
          <div className={styles.src}>
            <span>
              {sourceLabel(commitment.sourceArtifact.source)} ·{" "}
              {new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(
                commitment.sourceArtifact.occurredAt,
              )}
            </span>
            {commitment.sourceArtifact.url && (
              <a href={commitment.sourceArtifact.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
