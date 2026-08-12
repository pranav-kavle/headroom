type Classifiable = { direction: string; status: string };

const CLOSED_STATUSES = new Set(["fulfilled", "cancelled", "superseded", "rejected"]);

export function isNeedsYou(c: Classifiable): boolean {
  return c.direction === "owed_by_me" && (c.status === "at_risk" || c.status === "overdue");
}

export function isOnTrack(c: Classifiable): boolean {
  return c.direction === "owed_by_me" && c.status === "open";
}

export function isWaitingOnOthers(c: Classifiable): boolean {
  return c.direction === "owed_to_me" && !CLOSED_STATUSES.has(c.status);
}
