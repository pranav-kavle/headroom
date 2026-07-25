import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { createServer } from "../server";
import { createTestUser, deleteTestUser } from "../tools/__tests__/helpers";

async function connectedClient(server: ReturnType<typeof createServer>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("priority engine MCP server wiring", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await deleteTestUser(prisma, userId);
      userId = undefined;
    }
  });

  it("lists all 6 registered tools", async () => {
    const client = await connectedClient(createServer());

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      "classify_transaction",
      "compute_allocation",
      "get_projections",
      "get_state",
      "record_correction",
      "set_goal",
    ]);

    await client.close();
  });

  it("calls get_state through the protocol for a fresh user", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const client = await connectedClient(createServer());

    const result = await client.callTool({ name: "get_state", arguments: { userId: user.id } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      goalConfig: null,
      taxProfile: null,
      balances: [],
      latestPlan: null,
    });

    await client.close();
  });

  it("returns isError for compute_allocation (not yet implemented)", async () => {
    const user = await createTestUser(prisma);
    userId = user.id;
    const client = await connectedClient(createServer());

    const result = await client.callTool({
      name: "compute_allocation",
      arguments: { userId: user.id, agentRunId: "00000000-0000-0000-0000-000000000000" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("EPIC-11") })]),
    );

    await client.close();
  });
});
