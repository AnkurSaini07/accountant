// `bun run e2e`: browser tests in e2e/ against the real app on a fresh database (scripts/e2e-server.ts).
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // not 3000, so it runs alongside `bun run dev`

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure", // CI uploads test-results/ when a test fails
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun scripts/e2e-server.ts",
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false, // always a fresh database
    stdout: "pipe",
  },
});
