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
  // Static test-only VAPID pair for localhost e2e push delivery. Useless
  // outside this loopback setup (real subscriptions are never committed).
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BIJic5Z108nEvBfH5D9yohVTmdSot6AqkYDcTtEXb4UGvU7U9BNl9ZHPePIZFbSTFR2Wt0cqXK_BB_g7mIAJSbQ",
  VAPID_PRIVATE_KEY: "7WzuY156dUk14zgmJRTl7KXDXO5gF6eNr2uCNfPmPkg",
  VAPID_SUBJECT: "mailto:e2e@example.com",
  ALLOW_MEMORY_RATELIMIT: "1",
  NODE_TLS_REJECT_UNAUTHORIZED: "0",
  QSTASH_URL: "http://localhost:3210",
  QSTASH_STUB_PORT: "3210",
  QSTASH_STUB_SIGNING_KEY: "e2e-current-key",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    permissions: ["notifications"],
  },
  webServer: {
    command: "npm run start -- --port 3100",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    env: e2eEnv,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
