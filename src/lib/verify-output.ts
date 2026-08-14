// The output verifier — 2026-08-13 spec (turn identity / policy gate /
// verifier) §4.
//
// Core rule 1 says the engine computes and the model only phrases. Until now
// that was enforced by asking the model nicely: nothing checked that a figure
// in the spoken reply came from anywhere at all, which made "verifiable
// autonomy" a claim about intent rather than a property of the system. This is
// the check. It is deterministic, involves no model, and is the last thing
// between a fabricated number and a speaker.

export type ViolationKind = "spoke_identifier" | "spoke_machine_date" | "unsourced_number";

export interface Violation {
  kind: ViolationKind;
  detail: string;
}

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
      detail: `spoke an identifier out loud: ${id}`,
    });
  }

  for (const date of matches(input.text, ISO_DATE)) {
    violations.push({
      kind: "spoke_machine_date",
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
      detail: `said "${numeral}", which appears in no tool result, in no resolved date, and in nothing the user said`,
    });
  }

  return violations;
}
