import { AgentSession } from "@deepgram/agents";
import { buildAgentSettings } from "./src/lib/voice-session";

async function main() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY not set");

  const settings = buildAgentSettings({
    thinkEndpointUrl: "https://example.invalid/api/v1/agent/think",
    thinkAuthToken: "probe-token",
  });

  console.log("Sending listen.provider:", JSON.stringify(settings.listen.provider));

  const session = new AgentSession({
    auth: { apiKey },
    agent: settings,
  });

  session.on("welcome", (msg) => console.log("EVENT welcome", JSON.stringify(msg)));
  session.on("settings-applied", (msg) => console.log("EVENT settings-applied", JSON.stringify(msg)));
  session.on("error", (msg) => console.log("EVENT error", JSON.stringify(msg)));
  session.on("warning", (msg) => console.log("EVENT warning", JSON.stringify(msg)));
  session.on("injection-refused", (msg) => console.log("EVENT injection-refused", JSON.stringify(msg)));
  session.on("disconnected", () => console.log("EVENT disconnected"));

  await session.connect();
  console.log("connected, waiting 4s for settings-applied / error...");
  await new Promise((r) => setTimeout(r, 4000));
  session.disconnect();
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
