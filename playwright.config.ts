import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const PORT = Number(process.env.E2E_PORT || 3100);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SCHEMA = process.env.E2E_SCHEMA || 'e2e';

const database = new URL(
  process.env.DATABASE_URL || 'postgresql://ceylon:local_dev_only@127.0.0.1:55432/ceylon_eats',
);
database.searchParams.set('options', `-c search_path=${SCHEMA}`);

export default defineConfig({
  testDir: './tests/e2e',
  // The suite writes reviews into one shared database, so moderation queues stay
  // predictable only while a single worker runs the specs in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serves the compiled frontend and the API from one origin, which is how the
  // production build runs; APP_ORIGIN must match it or writes are rejected.
  webServer: {
    command: 'node scripts/e2e-db.mjs && npm run build && npm start',
    url: `${ORIGIN}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      DATABASE_URL: database.toString(),
      APP_ORIGIN: ORIGIN,
      PORT: String(PORT),
      NODE_ENV: 'development',
      // A whole browser suite arrives from one address in under a minute, which
      // the production budgets are meant to stop. Raise them for this run only.
      API_RATE_LIMIT: '100000',
      AUTH_RATE_LIMIT: '10000',
      REGISTER_RATE_LIMIT: '1000',
    },
  },
});
