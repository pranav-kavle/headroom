import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../server";

async function connectedClient(server: ReturnType<typeof createServer>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("engine MCP server wiring", () => {
  it("starts cleanly with an empty tool registry", async () => {
    const client = await connectedClient(createServer());

    expect(client.getServerCapabilities()?.tools).toBeUndefined();

    await client.close();
  });
});
