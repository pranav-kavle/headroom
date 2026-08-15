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

  // Compared by value, and read off both sides in both notations.
  //
  // This used to compare digit strings to digit strings, which quietly meant
  // the user's own words could not back the agent's own number. Asked to merge
  // "PR ninety one", the model wrote "91" — and 91 as digits appeared in
  // nothing, so every sentence about it was withheld and the user heard a
  // canned apology instead of an answer. The rule was never "the model must
  // echo the notation the evidence happened to use"; it is that a figure has to
  // trace to something. Ninety-one traces to ninety-one.
  const sourced = numberValuesIn(input.evidence.join(" "));

  for (const numeral of matches(spoken, NUMERAL)) {
    if (sourced.has(Number(numeral))) continue;
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
  for (const { word, value } of spokenNumbers(spoken)) {
    if (sourced.has(value)) continue;
    violations.push({
      kind: "unsourced_spoken_number",
      severity: "flagged",
      detail: `said "${word}", which matches no figure in any tool result, resolved date, or thing the user said`,
    });
  }

  return violations;
}

// Every figure a piece of text can be said to contain, as values — digits and
// spoken words alike, so the two notations can back each other.
function numberValuesIn(text: string): Set<number> {
  const clean = withoutIdentifiers(text);
  const values = new Set<number>((clean.match(NUMERAL) ?? []).map(Number));
  for (const { value } of spokenNumbers(clean)) values.add(value);
  return values;
}

// A tens word directly followed by a units word is one number: "ninety one"
// and "ninety-one" are both 91, and neither is a 90 next to a 1. Read greedily
// for exactly that reason — emitting the parts as well as the compound made
// "PR ninety-one" report a 90 and a 1 that no evidence would ever carry, which
// is the noise this check is supposed to be free of. Anything longer than a
// tens-units pair stays out of scope, the same way WORD_VALUES stops short of
// a general parser.
function spokenNumbers(text: string): Array<{ word: string; value: number }> {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const found = new Map<string, number>();

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const value = WORD_VALUES.get(word);
    if (value === undefined) continue;

    const next = words[index + 1];
    const nextValue = next === undefined ? undefined : WORD_VALUES.get(next);
    if (value >= 20 && value % 10 === 0 && nextValue !== undefined && nextValue >= 1 && nextValue <= 9) {
      found.set(`${word} ${next}`, value + nextValue);
      index++;
      continue;
    }

    found.set(word, value);
  }

  return [...found].map(([word, value]) => ({ word, value }));
}
