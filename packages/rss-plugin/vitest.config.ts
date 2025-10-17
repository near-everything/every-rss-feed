import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/__tests__/unit/**/*.test.ts",
      "src/__tests__/integration/**/*.test.ts"
    ],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000, // Extended for testcontainers startup
    hookTimeout: 30000, // Allow time for container startup/teardown
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
