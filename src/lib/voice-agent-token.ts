import type { EnvSource } from "./env";

// Design doc 2026-08-12-deepgram-voice-agent-design.md §5. Mints a short-lived
// connection token via Deepgram's grant endpoint rather than handing the raw
// API key to the browser — the browser's SDK calls this factory fresh before
// every connect and reconnect, per Deepgram's own token-factory pattern.
const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";

export function resolveDeepgramApiKey(env: EnvSource = process.env): string {
  const apiKey = env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set — the Voice Agent session cannot start.");
  }
  return apiKey;
}

interface DeepgramGrantResponse {
  access_token: string;
  expires_in: number;
}

export async function mintDeepgramAgentToken(
  options: { env?: EnvSource; fetchImpl?: typeof fetch } = {},
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const apiKey = resolveDeepgramApiKey(options.env);
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(DEEPGRAM_GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Deepgram token grant failed (${response.status})`);
  }

  const body = (await response.json()) as DeepgramGrantResponse;
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}
