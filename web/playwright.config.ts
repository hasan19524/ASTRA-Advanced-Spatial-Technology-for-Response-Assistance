import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.*"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "citizen",
      testMatch: ["**/trust-arc.spec.*"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "officer",
      testMatch: ["**/officer.spec.*", "**/trust-arc.spec.*"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The map and the assistant are available to every role, so they get
      // their own project instead of running twice under citizen + officer.
      name: "surface",
      testMatch: ["**/map.spec.*", "**/assistant.spec.*"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
