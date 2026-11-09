import { defineConfig, devices } from "@playwright/test";

const development = process.env.PIXEL_DEV === "1";
const port = development ? 3000 : 3100;
const baseURL = `http://${development ? "localhost" : "127.0.0.1"}:${port}`;

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
    command: `pnpm exec next ${development ? "dev" : "start"} --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: development && !process.env.CI,
    timeout: 60_000,
  },
});
