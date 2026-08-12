import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts", "tests/**/*.test.ts"],
        },
      },
      "packages/*/vitest.config.ts",
    ],
  },
});
