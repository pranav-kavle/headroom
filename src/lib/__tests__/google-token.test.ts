import { describe, expect, it, vi } from "vitest";

const getUserOauthAccessToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () => Promise.resolve({ users: { getUserOauthAccessToken } }),
}));

describe("getGoogleAccessToken", () => {
  it("returns the token when Google is connected", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "ya29_live" }], totalCount: 1 });
    const { getGoogleAccessToken } = await import("../google-token");

    const token = await getGoogleAccessToken("user_abc");

    expect(token).toBe("ya29_live");
    expect(getUserOauthAccessToken).toHaveBeenCalledWith("user_abc", "google");
  });

  it("returns null when there is no connected account yet", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [], totalCount: 0 });
    const { getGoogleAccessToken } = await import("../google-token");

    expect(await getGoogleAccessToken("user_abc")).toBeNull();
  });
});
