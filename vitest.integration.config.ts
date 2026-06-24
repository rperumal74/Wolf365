import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Integration tests run against a REAL local Postgres (see docs/LOCAL_DEV.md).
 * They are kept separate from the default unit-test run (which has no database,
 * including in CI). Files use the `*.itest.ts` suffix.
 */
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/integration-setup.ts"],
    include: ["src/**/*.itest.ts", "tests/**/*.itest.ts"],
    // Integration tests share one database; don't run files in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
