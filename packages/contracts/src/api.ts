// The client<->server contract — design doc §11, port rule 3. These describe
// JSON on the wire, so timestamps are ISO strings, not Date objects. Zod only:
// no Node built-ins, so this file runs unchanged in React Native.
import { z } from "zod";

export const ApiErrorResponse = z.object({
  error: z.string(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

export const UserSummary = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
export type UserSummary = z.infer<typeof UserSummary>;

// The profile fields live on /me rather than on UserSummary because
// UserSummary is also the shape of the /users list, which has no business
// carrying anyone's onboarding answers.
export const MeUser = UserSummary.extend({
  displayName: z.string().nullable(),
  role: z.string().nullable(),
  timezone: z.string().nullable(),
  onboardedAt: z.iso.datetime().nullable(),
});
export type MeUser = z.infer<typeof MeUser>;

export const MeResponse = z.object({
  user: MeUser,
});
export type MeResponse = z.infer<typeof MeResponse>;

// Body of PATCH /api/v1/me — the answers from the /welcome flow. Only
// displayName is required; the second card is skippable, and timezone is read
// off the browser rather than typed.
export const CompleteOnboardingRequest = z.object({
  displayName: z.string().trim().min(1).max(80),
  role: z.string().trim().max(140).nullish(),
  timezone: z.string().trim().max(64).nullish(),
});
export type CompleteOnboardingRequest = z.infer<typeof CompleteOnboardingRequest>;

export const UsersResponse = z.object({
  users: z.array(UserSummary),
});
export type UsersResponse = z.infer<typeof UsersResponse>;

// Deepgram Voice Agent design doc §5 — the browser mints a short-lived token
// here (never the raw Deepgram API key) and a signed, user-bound token here
// too, which it hands to Deepgram as a custom header on the `think` provider's
// endpoint config. `/api/v1/agent/think` verifies that signed token, since
// Deepgram calls that endpoint directly with no browser session attached.
export const AgentCitation = z.object({
  artifactId: z.string(),
  quote: z.string(),
});
export type AgentCitation = z.infer<typeof AgentCitation>;

export const AgentTokenResponse = z.object({
  deepgramAccessToken: z.string(),
  deepgramExpiresInSeconds: z.number(),
  thinkAuthToken: z.string(),
});
export type AgentTokenResponse = z.infer<typeof AgentTokenResponse>;

// Polled by the client after each agent utterance — §6 of the same doc. The
// citations for a turn are produced inside /api/v1/agent/think and never
// travel over Deepgram's socket, so they arrive on a side channel instead.
export const AgentTurnCitationsResponse = z.object({
  citations: z.array(AgentCitation),
});
export type AgentTurnCitationsResponse = z.infer<typeof AgentTurnCitationsResponse>;

export const HealthResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    db: z.literal("connected"),
  }),
  z.object({
    status: z.literal("error"),
    db: z.literal("unreachable"),
    message: z.string(),
  }),
]);
export type HealthResponse = z.infer<typeof HealthResponse>;
