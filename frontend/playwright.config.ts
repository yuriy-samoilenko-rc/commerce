import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against running servers:
 *   backend  (E2E_API_URL, default http://localhost:3000)
 *   frontend (E2E_BASE_URL, default http://localhost:3100)
 * The admin account comes from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    locale: "sr-Latn-ME",
    timezoneId: "Europe/Podgorica",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
