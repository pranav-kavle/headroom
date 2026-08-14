// The output verifier — 2026-08-13 spec (turn identity / policy gate /
// verifier) §4.
//
// Core rule 1 says the engine computes and the model only phrases. Until now
// that was enforced by asking the model nicely: nothing checked that a figure
// in the spoken reply came from anywhere at all, which made "verifiable
// autonomy" a claim about intent rather than a property of the system. This is
// the check. It is deterministic, involves no model, and is the last thing
// between a fabricated number and a speaker.

export type ViolationKind =
  | "spoke_identifier"
  | "spoke_machine_date"
  | "unsourced_number"
  | "unsourced_spoken_number";

// Not every check earns the right to take a reply away from the user.
//
// `withheld` is for checks with effectively no false positives: a UUID, an ISO
// date, or a numeral that appears in no evidence at all. `flagged` is for the
// spelled-out-number check, which is genuinely useful and genuinely noisy —
// "one moment" on a turn where the engine happened to return no 1 is a
// violation by the letter and nothing by the spirit. Flagging it records the
// problem on the turn without silencing the assistant, which is the only
// honest way to find out how often it actually fires before trusting it to
// block. Promote it once the rate is known; do not guess it now.
export type ViolationSeverity = "withheld" | "flagged";

export interface Violation {
  kind: ViolationKind;
  severity: ViolationSeverity;
  detail: string;
}

// Enough to cover how a person says a count or a date out loud. Deliberately
// not a general numeral parser: "a hundred and forty-two" is out of scope, and
// the check that reads this is advisory precisely because coverage like that
// is where false positives live.
const WORD_VALUES = new Map<string, number>([
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5],
  ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14],
  ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18],
  ["nineteen", 19], ["twenty", 20], ["thirty", 30], ["forty", 40],
  ["fifty", 50], ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90],
  ["first", 1], ["second", 2], ["third", 3], ["fourth", 4], ["fifth", 5],
  ["sixth", 6], ["seventh", 7], ["eighth", 8], ["ninth", 9], ["tenth", 10],
  ["eleventh", 11], ["twelfth", 12], ["thirteenth", 13], ["fourteenth", 14],
  ["fifteenth", 15], ["sixteenth", 16], ["seventeenth", 17], ["eighteenth", 18],
  ["nineteenth", 19], ["twentieth", 20], ["thirtieth", 30],
]);

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const NUMERAL = /\d+/g;

function matches(text: string, pattern: RegExp): string[] {
  return [...new Set(text.match(pattern) ?? [])];
}

// Identifiers are stripped before any numeral comparison, on both sides. A
// UUID is a dense source of accidental digit runs — "4f89" contains a 4 — so
// leaving them in would let an artifact id vouch for almost any small number
// the model cared to invent. An id is not evidence about anyone's life.
function withoutIdentifiers(text: string): string {
  return text.replace(UUID, " ");
}

export function verifySpokenText(input: {
  text: string;
  // Everything the turn is entitled to have got a figure from: tool results,
  // the principal block, and the user's own words.
  evidence: string[];
  // Whether a tool making claims about the user's life ran this turn. Core
  // rule 2 scopes provenance to exactly that, and the prompt permits ordinary
  // conversation on any topic — so an unscoped numeral check would block
  // "what's two plus two" and break the thing §4 of the harness doc allowed on
  // purpose.
  aboutUser: boolean;
}): Violation[] {
  const violations: Violation[] = [];

  for (const id of matches(input.text, UUID)) {
    violations.push({
      kind: "spoke_identifier",
      severity: "withheld",
      detail: `spoke an identifier out loud: ${id}`,
    });
  }

  for (const date of matches(input.text, ISO_DATE)) {
    violations.push({
      kind: "spoke_machine_date",
      severity: "withheld",
      detail: `spoke a machine-shaped date out loud: ${date}`,
    });
  }

  if (!input.aboutUser) return violations;

  // Both already reported under their own rule, and both are machine shapes
  // rather than figures — so they do not get double-counted as numerals.
  const spoken = withoutIdentifiers(input.text).replace(ISO_DATE, " ");

  const sourced = new Set(
    input.evidence.flatMap((source) => withoutIdentifiers(source).match(NUMERAL) ?? []),
  );

  for (const numeral of matches(spoken, NUMERAL)) {
    if (sourced.has(numeral)) continue;
    violations.push({
      kind: "unsourced_number",
      severity: "withheld",
      detail: `said "${numeral}", which appears in no tool result, in no resolved date, and in nothing the user said`,
    });
  }

  // The hole the digit check leaves: the prompt tells the model to speak
  // numbers as words, so the fabrication most likely to reach a speaker is
  // "three promises", not "3 promises". Compared by value, so "the fourteenth"
  // is backed by a `dueAt` of 2026-08-14.
  const sourcedValues = new Set([...sourced].map(Number));
  for (const word of spokenNumberWords(spoken)) {
    if (sourcedValues.has(WORD_VALUES.get(word) as number)) continue;
    violations.push({
      kind: "unsourced_spoken_number",
      severity: "flagged",
      detail: `said "${word}", which matches no figure in any tool result, resolved date, or thing the user said`,
    });
  }

  return violations;
}

function spokenNumberWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return [...new Set(words.filter((word) => WORD_VALUES.has(word)))];
}
