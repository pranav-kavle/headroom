import { beforeEach, describe, expect, it, vi } from "vitest";

const getGoogleHealthToken = vi.fn();
const upsertGoogleHealthToken = vi.fn();
vi.mock("@headroom/graph", () => ({
  getGoogleHealthToken: (userId: string) => getGoogleHealthToken(userId),
  upsertGoogleHealthToken: (input: unknown) => upsertGoogleHealthToken(input),
}));

const refreshGoogleHealthToken = vi.fn();
vi.mock("../google-health-oauth", () => ({
  refreshGoogleHealthToken: (input: unknown) => refreshGoogleHealthToken(input),
}));

const encryptToken = vi.fn();
const decryptToken = vi.fn();
vi.mock("../token-encryption", () => ({
  encryptToken: (plaintext: string) => encryptToken(plaintext),
  decryptToken: (encrypted: string, iv: string, authTag: string) => decryptToken(encrypted, iv, authTag),
}));

const STORED_ACCESS = { encrypted: "enc-access", iv: "iv-access", authTag: "tag-access" };
const STORED_REFRESH = { encrypted: "enc-refresh", iv: "iv-refresh", authTag: "tag-refresh" };

beforeEach(() => {
  vi.clearAllMocks();
  decryptToken.mockImplementation((encrypted: string) =>
    encrypted === STORED_ACCESS.encrypted ? "ya29.decrypted" : "1//refresh-decrypted",
  );
});

describe("getValidGoogleHealthAccessToken", () => {
  it("returns null when the user has never connected", async () => {
    getGoogleHealthToken.mockResolvedValue(null);
    const { getValidGoogleHealthAccessToken } = await import("../google-health-token");

    const token = await getValidGoogleHealthAccessToken({
      userId: "u1",
      now: new Date("2026-08-15T00:00:00.000Z"),
      clientId: "c",
      clientSecret: "s",
    });

    expect(token).toBeNull();
    expect(refreshGoogleHealthToken).not.toHaveBeenCalled();
  });

  it("decrypts and returns the stored access token without refreshing when it's still valid", async () => {
    getGoogleHealthToken.mockResolvedValue({
      accessToken: STORED_ACCESS,
      refreshToken: STORED_REFRESH,
      expiresAt: new Date("2026-08-15T01:00:00.000Z"),
    });
    const { getValidGoogleHealthAccessToken } = await import("../google-health-token");

    const token = await getValidGoogleHealthAccessToken({
      userId: "u1",
      now: new Date("2026-08-15T00:00:00.000Z"),
      clientId: "c",
      clientSecret: "s",
    });

    expect(token).toBe("ya29.decrypted");
    expect(decryptToken).toHaveBeenCalledWith(STORED_ACCESS.encrypted, STORED_ACCESS.iv, STORED_ACCESS.authTag);
    expect(refreshGoogleHealthToken).not.toHaveBeenCalled();
  });

  it("refreshes with the decrypted refresh token and stores a freshly encrypted access token when expired", async () => {
    getGoogleHealthToken.mockResolvedValue({
      accessToken: STORED_ACCESS,
      refreshToken: STORED_REFRESH,
      expiresAt: new Date("2026-08-15T00:00:00.000Z"),
    });
    refreshGoogleHealthToken.mockResolvedValue({
      accessToken: "ya29.refreshed",
      expiresAt: new Date("2026-08-15T02:00:00.000Z"),
    });
    const newEncryptedAccess = { encrypted: "enc-new", iv: "iv-new", authTag: "tag-new" };
    encryptToken.mockReturnValue(newEncryptedAccess);
    upsertGoogleHealthToken.mockResolvedValue({});
    const { getValidGoogleHealthAccessToken } = await import("../google-health-token");

    const now = new Date("2026-08-15T01:00:00.000Z");
    const token = await getValidGoogleHealthAccessToken({ userId: "u1", now, clientId: "c", clientSecret: "s" });

    expect(token).toBe("ya29.refreshed");
    expect(refreshGoogleHealthToken).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "1//refresh-decrypted", clientId: "c", clientSecret: "s", now }),
    );
    expect(encryptToken).toHaveBeenCalledWith("ya29.refreshed");
    expect(upsertGoogleHealthToken).toHaveBeenCalledWith({
      userId: "u1",
      accessToken: newEncryptedAccess,
      refreshToken: STORED_REFRESH,
      expiresAt: new Date("2026-08-15T02:00:00.000Z"),
    });
  });
});

describe("saveGoogleHealthToken", () => {
  it("encrypts both tokens before storing them", async () => {
    encryptToken.mockImplementation((plaintext: string) => ({
      encrypted: `enc-${plaintext}`,
      iv: `iv-${plaintext}`,
      authTag: `tag-${plaintext}`,
    }));
    upsertGoogleHealthToken.mockResolvedValue({});
    const { saveGoogleHealthToken } = await import("../google-health-token");

    const expiresAt = new Date("2026-08-15T05:00:00.000Z");
    await saveGoogleHealthToken({
      userId: "u1",
      accessToken: "ya29.new",
      refreshToken: "1//new-refresh",
      expiresAt,
    });

    expect(upsertGoogleHealthToken).toHaveBeenCalledWith({
      userId: "u1",
      accessToken: { encrypted: "enc-ya29.new", iv: "iv-ya29.new", authTag: "tag-ya29.new" },
      refreshToken: { encrypted: "enc-1//new-refresh", iv: "iv-1//new-refresh", authTag: "tag-1//new-refresh" },
      expiresAt,
    });
  });
});
