import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    hookTimeout: 30000, // For Testcontainers
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "./coverage",
    },
    alias: {
      "@workspace/infrastructure": path.resolve(__dirname, "./src"),
    },
  },
});
