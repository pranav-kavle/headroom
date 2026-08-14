import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integrations",
    environment: "node",
    testTimeout: 15000,
  },
});
