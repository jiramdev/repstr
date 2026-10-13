import { defineConfig, devices } from "@playwright/test";

const e2eEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/workout_e2e",
  NEXTAUTH_SECRET: "e2e-test-secret-1234567890",
  NEXTAUTH_URL: "http://localhost:3100",
  APP_URL: "http://localhost:3100",
  CRON_SECRET: "e2e-cron-secret",
  QSTASH_TOKEN: "e2e-qstash-token",
  QSTASH_CURRENT_SIGNING_KEY: "e2e-current-key",
  QSTASH_NEXT_SIGNING_KEY: "e2e-next-key",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "e2e-vapid-key",
  VAPID_PRIVATE_KEY: "e2e-vapid-private",
  VAPID_SUBJECT: "mailto:e2e@example.com",
  ALLOW_MEMORY_RATELIMIT: "1",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3100",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    env: e2eEnv,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
