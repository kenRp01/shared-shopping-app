import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3002);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const shouldStartWebServer =
  process.env.E2E_SKIP_WEB_SERVER !== "1" && /https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Guest-mode tests share browser-local storage, so keep E2E deterministic.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: `PATH=/usr/local/Cellar/node/25.9.0_2/bin:$PATH /usr/local/Cellar/node/25.9.0_2/bin/node /usr/local/Cellar/node/25.9.0_2/libexec/lib/node_modules/npm/bin/npm-cli.js run dev -- --hostname localhost --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
