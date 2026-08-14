import { describe, expect, it, vi } from "vitest";

const getUserOauthAccessToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () => Promise.resolve({ users: { getUserOauthAccessToken } }),
}));

describe("getGithubAccessToken", () => {
  it("returns the token when GitHub is connected", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "gho_live" }], totalCount: 1 });
    const { getGithubAccessToken } = await import("../github-token");

    const token = await getGithubAccessToken("user_abc");

    expect(token).toBe("gho_live");
    expect(getUserOauthAccessToken).toHaveBeenCalledWith("user_abc", "github");
  });

  it("returns null when there is no connected account yet", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [], totalCount: 0 });
    const { getGithubAccessToken } = await import("../github-token");

    expect(await getGithubAccessToken("user_abc")).toBeNull();
  });
});
