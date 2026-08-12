import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/token-encryption";

const VALID_KEY = "a".repeat(64); // 32 bytes as hex

describe("token encryption", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = previousKey;
  });

  it("round-trips a token", () => {
    const { encrypted, iv, authTag } = encryptToken("ghp_example_token");

    expect(encrypted).not.toContain("ghp_example_token");
    expect(decryptToken(encrypted, iv, authTag)).toBe("ghp_example_token");
  });

  it("uses a fresh iv per call, so identical plaintexts encrypt differently", () => {
    const first = encryptToken("same-token");
    const second = encryptToken("same-token");

    expect(first.iv).not.toBe(second.iv);
    expect(first.encrypted).not.toBe(second.encrypted);
  });

  it("rejects a tampered ciphertext", () => {
    const { encrypted, iv, authTag } = encryptToken("secret");
    const bytes = Buffer.from(encrypted, "base64");
    bytes[0] ^= 0xff;

    expect(() => decryptToken(bytes.toString("base64"), iv, authTag)).toThrow();
  });

  it("refuses a key that is not 32 bytes", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abcd";

    expect(() => encryptToken("anything")).toThrow(/32 bytes/);
  });

  it("refuses a missing key", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => encryptToken("anything")).toThrow(/not set/);
  });
});
