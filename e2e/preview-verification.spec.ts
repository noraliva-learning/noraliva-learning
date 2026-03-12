/**
 * Preview verification: run against PREVIEW_URL (Vercel preview deployment).
 * Verifies the working learner flow: login → dashboard → start session → question → submit → feedback.
 * Reusable for any preview branch: set PREVIEW_URL to the branch's deployment URL.
 *
 * Requires: PREVIEW_URL, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD
 * Optional: VERCEL_AUTOMATION_BYPASS_SECRET for protected previews.
 * Run: PREVIEW_URL=https://... npm run verify:preview
 */
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { test, expect } from '@playwright/test';

loadEnv({ path: path.join(process.cwd(), '.env.local') });

const previewUrl = process.env.PREVIEW_URL?.trim();
const learnerEmail = process.env.TEST_LEARNER_EMAIL?.trim();
const learnerPassword = process.env.TEST_LEARNER_PASSWORD?.trim();
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const prereqSeeded = process.env.PREREQ_SEEDED === 'true';

test.skip(
  !previewUrl || !learnerEmail || !learnerPassword,
  'PREVIEW_URL, TEST_LEARNER_EMAIL, and TEST_LEARNER_PASSWORD must be set'
);

test.describe('Preview verification', () => {
  test('preview: login → dashboard → start session → question → submit → feedback', async ({
    page,
  }) => {
    const loginPath = '/v2/login';
    const loginUrl = bypassSecret
      ? `${previewUrl!.replace(/\/$/, '')}${loginPath}?x-vercel-protection-bypass=${encodeURIComponent(bypassSecret)}&x-vercel-set-bypass-cookie=true`
      : loginPath;
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    if (await page.getByText('Log in to Vercel').isVisible().catch(() => false)) {
      throw new Error(
        bypassSecret
          ? 'Preview URL is behind Vercel deployment protection and the bypass did not apply. ' +
            'In Vercel: Settings → Deployment Protection → ensure "Protection Bypass for Automation" is enabled and the secret matches VERCEL_AUTOMATION_BYPASS_SECRET in .env.local.'
          : 'Preview URL is behind Vercel deployment protection. ' +
              'Set VERCEL_AUTOMATION_BYPASS_SECRET and enable "Protection Bypass for Automation" in Vercel (Settings → Deployment Protection), ' +
              'or use a preview URL that serves the app directly.'
      );
    }

    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('#password').or(page.locator('input[type="password"]')).or(page.locator('form input').nth(1))
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/email/i).fill(learnerEmail!);
    const passwordField = page.locator('#password').or(page.locator('input[type="password"]')).first();
    await passwordField.fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle)\b/, { timeout: 15000 });

    await page.goto('/v2/learn');
    await expect(page.getByRole('button', { name: /start session/i })).toBeVisible();
    await page.getByRole('button', { name: /start session/i }).click();

    await expect(page).toHaveURL(/\/v2\/learn\/session\/[a-f0-9-]+/, { timeout: 15000 });

    await expect(page.getByText(/question 1/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/no content yet|couldn't generate|nothing to practice just yet|couldn't find a question/i)).not.toBeVisible();

    const submitBtn = page.getByRole('button', { name: /submit|check my answer/i });
    await expect(submitBtn).toBeVisible();
    const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
    await expect(input).toBeVisible();
    await input.fill('4');
    await submitBtn.click();

    const feedbackOrNext = page
      .getByRole('button', { name: /next question/i })
      .or(page.getByText(/nice job|good try|correct!|not quite\./i))
      .first();
    await expect(feedbackOrNext).toBeVisible({ timeout: 30000 });
  });

  test('preview: prerequisites locked (Math dependent skill hidden)', async ({ page }) => {
    test.skip(
      !prereqSeeded,
      'PREREQ_SEEDED=true is required to run the prerequisite-locked preview verification'
    );

    const loginPath = '/v2/login';
    const loginUrl = bypassSecret
      ? `${previewUrl!.replace(/\/$/, '')}${loginPath}?x-vercel-protection-bypass=${encodeURIComponent(
          bypassSecret
        )}&x-vercel-set-bypass-cookie=true`
      : loginPath;
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    if (await page.getByText('Log in to Vercel').isVisible().catch(() => false)) {
      throw new Error(
        bypassSecret
          ? 'Preview URL is behind Vercel deployment protection and the bypass did not apply. ' +
            'In Vercel: Settings → Deployment Protection → ensure "Protection Bypass for Automation" is enabled and the secret matches VERCEL_AUTOMATION_BYPASS_SECRET in .env.local.'
          : 'Preview URL is behind Vercel deployment protection. ' +
              'Set VERCEL_AUTOMATION_BYPASS_SECRET and enable "Protection Bypass for Automation" in Vercel (Settings → Deployment Protection), ' +
              'or use a preview URL that serves the app directly.'
      );
    }

    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('#password').or(page.locator('input[type="password"]')).or(page.locator('form input').nth(1))
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/email/i).fill(learnerEmail!);
    const passwordField = page.locator('#password').or(page.locator('input[type="password"]')).first();
    await passwordField.fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle)\b/, { timeout: 15000 });

    await page.goto('/v2/learn');
    await expect(page.getByRole('button', { name: /start session/i })).toBeVisible();
    await page.getByRole('button', { name: /start session/i }).click();

    await expect(page).toHaveURL(/\/v2\/learn\/session\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByText(/question 1/i)).toBeVisible({ timeout: 20000 });

    // Locked-case assertion: dependent skill content from the seeded prerequisite should NOT appear.
    await expect(page.getByText(/addition with carry/i)).not.toBeVisible();
    await expect(page.getByText(/what is 15 \+ 7\?/i)).not.toBeVisible();
  });
});
