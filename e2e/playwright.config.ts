import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Runs against a locally-served app. See docs/LOCAL_DEV.md
 * for setup (install @playwright/test + browsers first). Kept out of tsc/CI;
 * runs locally on your Mac.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Start the app automatically unless E2E_BASE_URL points at an already-running
  // instance. Build + start gives a production-like run.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        timeout: 180_000,
        reuseExistingServer: true,
      },
});
