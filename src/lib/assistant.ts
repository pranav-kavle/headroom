/**
 * The assistant's name.
 *
 * It is spoken and transcribed on every voice turn (design doc §9), so it is
 * deliberately two syllables, phonetically distinct, and *not* a common English
 * word — a word-name would collide with real content in transcripts and could
 * not be safely used as an STT keyterm boost (§6).
 *
 * Kept as one constant so the onboarding copy, the empty states, and the voice
 * agent's system prompt cannot drift apart.
 */
export const ASSISTANT_NAME = "Otto";

/**
 * How the user is named on screen. Falls back to the part of the email before
 * the @ so anyone who reaches the app without finishing /welcome is still
 * addressed as a person rather than as an address.
 */
export function accountName(displayName: string | null, email: string): string {
  return displayName?.trim() || email.split("@")[0];
}

/** First name only, for greetings. */
export function greetingName(displayName: string | null, email: string): string {
  return accountName(displayName, email).split(/\s+/)[0];
}
