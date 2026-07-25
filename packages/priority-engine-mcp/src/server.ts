import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "./db";
import { classifyTransaction, classifyTransactionInputShape } from "./tools/classify-transaction";
import { computeAllocation, computeAllocationInputShape } from "./tools/compute-allocation";
import { getProjections, getProjectionsInputShape } from "./tools/get-projections";
import { getState, getStateInputShape } from "./tools/get-state";
import { recordCorrection, recordCorrectionInputShape } from "./tools/record-correction";
import { setGoal, setGoalInputShape } from "./tools/set-goal";

async function toToolResult(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await work();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "priority-engine-mcp", version: "0.1.0" });

  server.registerTool(
    "get_state",
    {
      description: "Read the current goal config, tax profile, balances, and latest plan for a user.",
      inputSchema: getStateInputShape,
    },
    (input) => toToolResult(() => getState(prisma, input)),
  );

  server.registerTool(
    "set_goal",
    {
      description: "Write a new versioned goal config, superseding the prior current version.",
      inputSchema: setGoalInputShape,
    },
    (input) => toToolResult(() => setGoal(prisma, input)),
  );

  server.registerTool(
    "classify_transaction",
    {
      description: "Record a model-proposed transaction classification.",
      inputSchema: classifyTransactionInputShape,
    },
    (input) => toToolResult(() => classifyTransaction(prisma, input)),
  );

  server.registerTool(
    "record_correction",
    {
      description: "Record a user correction to a transaction classification.",
      inputSchema: recordCorrectionInputShape,
    },
    (input) => toToolResult(() => recordCorrection(prisma, input)),
  );

  server.registerTool(
    "compute_allocation",
    {
      description: "Compute the priority waterfall allocation for a user. Not yet implemented.",
      inputSchema: computeAllocationInputShape,
    },
    (input) => toToolResult(() => computeAllocation(prisma, input)),
  );

  server.registerTool(
    "get_projections",
    {
      description: "Read income/runway/spend projections for a plan. Not yet implemented.",
      inputSchema: getProjectionsInputShape,
    },
    (input) => toToolResult(() => getProjections(prisma, input)),
  );

  return server;
}
