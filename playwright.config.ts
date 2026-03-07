import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Ensure webServer and test workers get env from .env.local (e.g. NEXT_PUBLIC_*, TEST_LEARNER_*)
const envLocalPath = path.join(__dirname, '.env.local');
const parsed = loadEnv({ path: envLocalPath }).parsed ?? {};
if (Object.keys(parsed).length) Object.assign(process.env, parsed);
const webServerEnv: NodeJS.ProcessEnv = { ...process.env, ...parsed };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: webServerEnv,
  },
});
