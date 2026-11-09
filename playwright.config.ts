import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./src/tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PIXEL_COMPAT === "1" ? [
      { name: "firefox", testMatch: "compatibility.spec.ts", use: { ...devices["Desktop Firefox"] } },
      { name: "edge", testMatch: "compatibility.spec.ts", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    ] : []),
  ],
  webServer: {
    command: "pnpm exec next start --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
