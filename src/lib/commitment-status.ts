export const STATUS_LABELS: Record<string, string> = {
  open: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
  fulfilled: "Done",
  cancelled: "Cancelled",
  superseded: "Superseded",
  rejected: "Rejected",
};

export function pillTone(status: string): "red" | "amber" | "green" {
  if (status === "overdue") return "red";
  if (status === "at_risk") return "amber";
  return "green";
}
