import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

// Verification, not a test seam: a few phone-viewport journeys against the production build
// (service worker included). Run `pnpm build` first; CI does.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
