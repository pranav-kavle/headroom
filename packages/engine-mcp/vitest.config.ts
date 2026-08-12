import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "engine-mcp",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
