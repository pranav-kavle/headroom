import type { ActionRow } from "@headroom/graph";
import styles from "./LedgerView.module.css";

function actionTime(action: ActionRow): Date {
  return action.executedAt ?? action.agentRun.startedAt;
}

function humanizeKind(kind: string): string {
  return kind
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupByDay(actions: ActionRow[]): Array<{ label: string; actions: ActionRow[] }> {
  const groups: Array<{ label: string; actions: ActionRow[] }> = [];
  for (const action of actions) {
    const label = dayLabel(actionTime(action));
    const current = groups[groups.length - 1];
    if (current?.label === label) {
      current.actions.push(action);
    } else {
      groups.push({ label, actions: [action] });
    }
  }
  return groups;
}

export function LedgerView({ actions }: { actions: ActionRow[] }) {
  const todayCount = actions.filter((a) => dayLabel(actionTime(a)) === "Today").length;
  const groups = groupByDay(actions);

  return (
    <main className={styles.screen}>
      <div className={styles.eyebrow}>Ledger</div>
      <div className={styles.display}>{todayCount} actions today.</div>
      <div className={styles.sub}>All reversible. Nothing left this device without you approving it.</div>

      {actions.length === 0 ? (
        <div className={styles.empty}>Nothing logged yet.</div>
      ) : (
        <div className={styles.timeline}>
          {groups.map((group, i) => (
            <div key={`${group.label}-${i}`}>
              {i > 0 && <div className={styles.daybreak}>{group.label}</div>}
              {group.actions.map((action) => (
                <div className={styles.entry} key={action.id} data-done={action.status === "approved"}>
                  <div className={styles.entryTime}>
                    {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(actionTime(action))}
                  </div>
                  <div className={styles.entryLabel}>{humanizeKind(action.kind)}</div>
                  <div className={styles.entryMeta}>
                    <em>{action.externalRef ?? action.status}</em>
                    {action.status === "executed" && <span className={styles.undo}>Undo</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
