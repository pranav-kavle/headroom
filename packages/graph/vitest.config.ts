import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "graph",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
