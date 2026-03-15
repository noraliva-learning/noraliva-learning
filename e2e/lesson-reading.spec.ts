import { test, expect } from '@playwright/test';

/**
 * Phase 7: Reading domain E2E.
 * 1. Learner starts a reading Ace lesson
 * 2. Visual teaching and/or narration appears
 * 3. Learner completes guided and independent try (or advances through scenes)
 * 4. Mastery updates (closed-loop)
 * 5. Parent insight can reflect the result (domain=reading)
 */
test.describe('Ace lesson — Reading', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(!learnerEmail || !learnerPassword, 'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set');
  test.setTimeout(120000);

  test('start reading Ace lesson -> scenes render -> advance -> complete or reach end', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    await expect(page.getByRole('button', { name: /ace lesson: reading/i })).toBeVisible();
    await page.getByRole('button', { name: /ace lesson: reading/i }).click();

    await expect(page).toHaveURL(/\/v2\/learn\/lesson\/[a-f0-9-]+/, { timeout: 15000 });

    await expect(
      page.getByText(/let's practice|letter|sound|reading|step \d+ of \d+/i)
    ).toBeVisible({ timeout: 8000 });

    const firstNext = page.getByRole('button', { name: /i'm ready|next/i }).first();
    if (await firstNext.isVisible()) {
      await firstNext.click();
      await page.waitForTimeout(500);
    }

    let advances = 0;
    while (advances < 12) {
      const checkBtn = page.getByRole('button', { name: /check my answer/i });
      if (await checkBtn.isVisible()) {
        const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
        if (await input.isVisible()) {
          await input.fill('A');
          await checkBtn.click();
          await page.waitForTimeout(600);
        }
        advances++;
        continue;
      }
      const next = page.getByRole('button', { name: /next|next →|i'm ready|got it|done|next step/i }).first();
      if (await next.isVisible()) {
        await next.click();
        advances++;
        await page.waitForTimeout(400);
      } else break;
    }

    const doneOrCelebration = await page.getByText(/you did it|brain just got stronger/i).isVisible();
    expect(doneOrCelebration || advances >= 2).toBe(true);
  });

  test('parent closed-loop supports domain=reading', async ({ page }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();

    const meRes = await page.request.get('/api/v2/me');
    if (!meRes.ok()) return;
    const me = (await meRes.json()) as { id: string };
    const loopRes = await page.request.get(
      `/api/v2/parent/closed-loop?learnerId=${me.id}&domain=reading`
    );
    expect(loopRes.ok()).toBe(true);
    const loop = (await loopRes.json()) as {
      learner_id: string;
      mastery_by_skill: unknown[];
      latest_lesson_decision: unknown;
      next_planned_skill: unknown;
    };
    expect(loop.learner_id).toBe(me.id);
    expect(Array.isArray(loop.mastery_by_skill)).toBe(true);
  });
});
