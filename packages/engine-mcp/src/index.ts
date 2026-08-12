// Library entry point. The stdio bootstrap lives in `bin.ts` — importing this
// package must not start a server, because the Next app consumes the tool
// registry in-process (design doc §7 keeps MCP as the port's shape, not its
// transport; see the voice-agent-harness spec §3).
export { createServer } from "./server";
export { engineTools, buildState, getActionPolicy } from "./tools";
export type {
  EngineContext,
  EngineTool,
  ToolInputSchema,
  EngineState,
  StateCommitmentInput,
  ActionPolicy,
  ActionTier,
} from "./tools";
