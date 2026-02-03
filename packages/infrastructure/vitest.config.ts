import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load .env.test for test isolation (dedicated Neon test branch)
config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    hookTimeout: 30000,
    fileParallelism: false,
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
