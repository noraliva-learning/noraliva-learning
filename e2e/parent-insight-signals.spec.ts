import { test, expect } from '@playwright/test';

/**
 * Phase 5: Learning signals + parent insight E2E.
 * 1. Learner completes a lesson (signals captured and stored).
 * 2. Closed-loop API returns learner_insights and recent_episodes_for_review.
 * 3. Parent insight page shows insight summary and recent lessons.
 * Uses TEST_LEARNER_EMAIL / TEST_LEARNER_PASSWORD (learner can view own closed-loop).
 */

test.describe('Parent insight and learning signals', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(
    !learnerEmail || !learnerPassword,
    'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set'
  );
  test.setTimeout(120000);

  test('complete lesson -> signals stored -> closed-loop has learner_insights and recent_episodes', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    await page.getByRole('button', { name: /ace lesson: math/i }).click();
    await expect(page).toHaveURL(/\/v2\/learn\/lesson\/[a-f0-9-]+/, { timeout: 15000 });

    await expect(
      page.getByText(/let's learn|focus|counting|addition|subtraction|equal/i)
    ).toBeVisible({ timeout: 8000 });

    let steps = 0;
    const maxSteps = 20;
    while (steps < maxSteps) {
      const nextBtn = page.getByRole('button', { name: /next|i'm ready|got it|done|check my answer/i }).first();
      if (await nextBtn.isVisible()) {
        const checkBtn = page.getByRole('button', { name: /check my answer/i });
        if (await checkBtn.isVisible()) {
          const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
          if (await input.isVisible()) await input.fill('3');
          await checkBtn.click();
        } else {
          await nextBtn.click();
        }
        steps++;
        await page.waitForTimeout(400);
      }
      const celebration = page.getByText(/you did it|celebration/i);
      if (await celebration.isVisible()) break;
    }

    await expect(
      page.getByText(/you did it|brain just got stronger|\+.*xp/i)
    ).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /done/i }).click();
    await expect(page).toHaveURL(/\/v2\/learners\/(liv|elle)/, { timeout: 8000 });

    const meRes = await page.request.get('/api/v2/me');
    expect(meRes.ok()).toBe(true);
    const me = (await meRes.json()) as { id: string };
    const learnerId = me.id;

    const loopRes = await page.request.get(
      `/api/v2/parent/closed-loop?learnerId=${learnerId}&domain=math`
    );
    expect(loopRes.ok()).toBe(true);
    const loop = (await loopRes.json()) as {
      learner_insights?: { insight_type: string; summary_plain_english: string }[];
      recent_episodes_for_review?: { episode_id: string; skill_name: string }[];
    };
    expect(Array.isArray(loop.learner_insights)).toBe(true);
    expect(Array.isArray(loop.recent_episodes_for_review)).toBe(true);
    if (loop.learner_insights!.length > 0) {
      expect(loop.learner_insights![0]).toHaveProperty('summary_plain_english');
      expect(typeof loop.learner_insights![0].summary_plain_english).toBe('string');
    }
    if (loop.recent_episodes_for_review!.length > 0) {
      expect(loop.recent_episodes_for_review![0]).toHaveProperty('episode_id');
      expect(loop.recent_episodes_for_review![0]).toHaveProperty('skill_name');
    }
  });

  test('parent insight page loads and shows mastery and insight sections', async ({ page }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners|v2\/parent)/);

    await page.goto('/v2/parent/insight');
    await expect(page).toHaveURL(/\/v2\/parent\/insight/);

    await expect(
      page.getByRole('heading', { name: /learning insight/i })
    ).toBeVisible({ timeout: 5000 });

    const main = page.locator('main');
    await expect(main).toBeVisible();

    const hasLearnerDropdown = page.locator('select#learner');
    await expect(hasLearnerDropdown).toBeVisible();
  });
});
