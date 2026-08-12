import { describe, expect, it, vi } from "vitest";
import { mintDeepgramAgentToken, resolveDeepgramApiKey } from "../voice-agent-token";

function grantResponse(accessToken: string, expiresIn: number) {
  return new Response(JSON.stringify({ access_token: accessToken, expires_in: expiresIn }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveDeepgramApiKey", () => {
  it("throws naming DEEPGRAM_API_KEY when it is missing", () => {
    expect(() => resolveDeepgramApiKey({})).toThrow(/DEEPGRAM_API_KEY/);
  });
});

describe("mintDeepgramAgentToken", () => {
  it("returns the access token and its TTL from Deepgram's grant endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(grantResponse("dg-jwt", 30));

    const result = await mintDeepgramAgentToken({
      env: { DEEPGRAM_API_KEY: "dg-key" },
      fetchImpl,
    });

    expect(result).toEqual({ accessToken: "dg-jwt", expiresInSeconds: 30 });
  });

  it("authenticates the grant request with Deepgram's Token scheme", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(grantResponse("dg-jwt", 30));

    await mintDeepgramAgentToken({ env: { DEEPGRAM_API_KEY: "dg-key" }, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.deepgram.com/v1/auth/grant");
    expect(init.headers.Authorization).toBe("Token dg-key");
  });

  it("throws when Deepgram rejects the grant request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));

    await expect(
      mintDeepgramAgentToken({ env: { DEEPGRAM_API_KEY: "bad" }, fetchImpl }),
    ).rejects.toThrow(/deepgram/i);
  });
});
