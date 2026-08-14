// The second system block — 2026-08-13 spec §4.
//
// Two things the agent could not previously know: who it is talking to, and
// what day it is where they are. Both are per-user, so this block sits *after*
// the cached policy prefix and is rebuilt every turn (§4's table). It stays
// small for exactly that reason.
//
// Pure: `now` is injected, nothing here reads a clock or the environment, so
// every date below is as testable as the engine's own.

export interface Principal {
  displayName: string | null;
  role: string | null;
  timezone: string | null;
}

// Matches CompleteOnboardingRequest's caps — the contract is the boundary that
// should have held, and this is the second place it holds.
const NAME_MAX = 80;
const ROLE_MAX = 140;

const DAYS_AHEAD = 7;

// §4.3. This text was typed into a form by a human and is about to sit inside a
// system prompt, so it is treated as hostile: no newlines (they forge
// structure), no control characters, and no angle brackets (they close the
// delimiter this value sits inside). The words survive; the structure cannot.
function sanitize(value: string | null, max: number): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function formatterFor(timezone: string | null, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone || "UTC", ...options });
  } catch {
    // Bad stored data is not a reason to fail a voice turn.
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });
  }
}

function isoDay(date: Date, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return isoDay(date, null);
  }
}

// "Thursday 13 August 2026" — assembled from parts rather than taken from a
// locale pattern, so the wording is ours and does not drift with ICU data.
function spokenDay(date: Date, timezone: string | null, withYear: boolean): string {
  const parts = formatterFor(timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = withYear ? ` ${get("year")}` : "";
  return `${get("weekday")} ${get("day")} ${get("month")}${year}`;
}

// §4.1. The engine resolves the next seven days so the model's only remaining
// operation on a date is *lookup* — this tightens core rule 1 rather than
// loosening it, and it is what makes get_flight_status (which needs
// YYYY-MM-DD) callable at all under a prompt that bans date arithmetic.
//
// The days are built from today's local calendar date and then formatted in
// UTC, not by adding 24h to the current instant: an hour of DST would
// otherwise be enough to name a day twice or skip one.
function dateTable(now: Date, timezone: string | null): string {
  const [year, month, day] = isoDay(now, timezone).split("-").map(Number);

  const rows: string[] = [];
  for (let offset = 1; offset <= DAYS_AHEAD; offset++) {
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    const label = offset === 1 ? `tomorrow, ${spokenDay(date, null, false)}` : spokenDay(date, null, false);
    rows.push(`  ${label} — ${isoDay(date, null)}`);
  }
  return rows.join("\n");
}

export function buildPrincipalBlock(principal: Principal, now: Date): string {
  const { timezone } = principal;
  const name = sanitize(principal.displayName, NAME_MAX);
  const role = sanitize(principal.role, ROLE_MAX);
  const zoneLabel = timezone || "UTC";

  return `<principal>
name: ${name ?? "(unknown — you have not been told it; ask, do not invent one)"}
role: ${role ?? "(unknown)"}
</principal>

Today is ${spokenDay(now, timezone, true)} (${isoDay(now, timezone)}) in ${zoneLabel}.
Dates already resolved for you — read them from here, never count them out:
${dateTable(now, timezone)}`;
}
