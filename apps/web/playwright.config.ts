import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  fullyParallel: false,
  use: {
    baseURL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
