import { test, expect } from '@playwright/test';

/**
 * Phase 8 — Buddy, world layer, daily mission, break (E2E smoke).
 * Full flow with login requires TEST_LEARNER_EMAIL / TEST_LEARNER_PASSWORD.
 */

test('v2 login page still reachable', async ({ page }) => {
  await page.goto('/v2/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});

test.describe('Phase 8 learner world (authenticated)', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(!learnerEmail || !learnerPassword, 'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set');

  test('choose buddy → start practice → first answer → daily celebration path', async ({ page }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    const url = page.url();
    const slugMatch = url.match(/v2\/learners\/(liv|elle)/);
    const slug = slugMatch ? slugMatch[1] : 'liv';
    await page.goto(`/v2/learners/${slug}`);

    await expect(page.getByTestId('learner-home')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('buddy-picker')).toBeVisible();

    await page.getByTestId('buddy-option-owl').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Math/i }).first().click();
    await expect(page).toHaveURL(/\/v2\/learn\/session\//, { timeout: 20000 });

    await expect(page.getByTestId('buddy-avatar').first()).toBeVisible({ timeout: 15000 });
    const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
    await expect(input).toBeVisible({ timeout: 20000 });
    await input.fill('42');
    await page.getByRole('button', { name: /check my answer/i }).click();

    await expect(page.getByRole('button', { name: /next question/i })).toBeVisible({ timeout: 30000 });

    const dailyCelebration = page.getByTestId('celebration-daily-complete');
    try {
      await expect(dailyCelebration).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: /^ok!$/i }).click();
    } catch {
      /* daily may already be met today */
    }

    await page.goto(`/v2/learners/${slug}`);
    await expect(page.getByTestId('daily-mission-card')).toBeVisible();
  });
});
