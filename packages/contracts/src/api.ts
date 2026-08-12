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

export const MeResponse = z.object({
  user: UserSummary,
});
export type MeResponse = z.infer<typeof MeResponse>;

export const UsersResponse = z.object({
  users: z.array(UserSummary),
});
export type UsersResponse = z.infer<typeof UsersResponse>;

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
