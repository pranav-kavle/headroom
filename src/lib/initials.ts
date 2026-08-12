export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[1][0]] : [local[0], local[1]];
  return (
    letters
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?"
  );
}
