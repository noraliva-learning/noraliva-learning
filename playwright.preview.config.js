/**
 * Playwright config for preview verification only.
 * Uses PREVIEW_URL as baseURL; no local web server.
 * Optional: VERCEL_AUTOMATION_BYPASS_SECRET to access protected previews (header x-vercel-protection-bypass).
 * Run: PREVIEW_URL=https://... npm run verify:preview
 */
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const baseURL = process.env.PREVIEW_URL && process.env.PREVIEW_URL.trim()
  ? process.env.PREVIEW_URL.trim()
  : 'http://localhost:3000';

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const extraHTTPHeaders = bypassSecret
  ? {
      'x-vercel-protection-bypass': bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : undefined;

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: 'preview-verification.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-preview' }]],
  use: {
    baseURL,
    ...(extraHTTPHeaders && { extraHTTPHeaders }),
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
