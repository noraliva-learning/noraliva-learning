import { test, expect } from '@playwright/test';

/**
 * Phase 6: Visual teaching sequence E2E.
 * Verifies:
 * 1. Visual teaching sequence renders (when plan includes it)
 * 2. Animation steps advance (Next step)
 * 3. Narration replay available
 * 4. Learner can proceed to Work Mat or guided try
 *
 * Uses generate-plan with learner that may get visual teaching when modality is visual.
 * If the generated plan has no visual_teaching_sequence (e.g. no insights), test still passes
 * by advancing through focus/concept as usual.
 */
test.describe('Visual teaching sequence in lesson', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(!learnerEmail || !learnerPassword, 'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set');
  test.setTimeout(120000);

  test('lesson may show visual_teaching_sequence; steps advance and proceed to next scene', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    await expect(page.getByRole('button', { name: /ace lesson: math/i })).toBeVisible();
    await page.getByRole('button', { name: /ace lesson: math/i }).click();

    await expect(page).toHaveURL(/\/v2\/learn\/lesson\/[a-f0-9-]+/, { timeout: 15000 });

    // First scene: focus ("Let's learn") or direct to concept
    await expect(
      page.getByText(/let's learn|focus|counting|addition|equal|step \d+ of \d+/i)
    ).toBeVisible({ timeout: 8000 });

    // Advance past focus if present (button "Next" or "I'm ready")
    const firstNext = page.getByRole('button', { name: /i'm ready|next/i }).first();
    if (await firstNext.isVisible()) {
      await firstNext.click();
      await page.waitForTimeout(600);
    }

    // Check if we're on visual_teaching_sequence (Step 1 of N, Replay, Next step)
    const stepIndicator = page.getByText(/step \d+ of \d+/i);
    const replayButton = page.getByRole('button', { name: /replay/i });
    const nextStepButton = page.getByRole('button', { name: /next step/i });
    const nextArrowButton = page.getByRole('button', { name: /next →/i });

    if (await stepIndicator.isVisible()) {
      // Visual teaching sequence is showing
      expect(await stepIndicator.isVisible()).toBe(true);

      // Replay should be present
      await expect(replayButton).toBeVisible();

      // Advance through steps: click "Next step" until we see "Next →"
      let steps = 0;
      while (steps < 8) {
        if (await nextArrowButton.isVisible()) {
          await nextArrowButton.click();
          break;
        }
        if (await nextStepButton.isVisible()) {
          await nextStepButton.click();
          steps++;
          await page.waitForTimeout(500);
        } else break;
      }

      // After leaving visual teaching we should hit concept or worked example or manipulative
      await expect(
        page.getByText(/count|add|equal|example|move the pieces|your turn|how many/i)
      ).toBeVisible({ timeout: 6000 });
    }

    // Proceed through rest of lesson until guided try (or end)
    let advances = 0;
    while (advances < 15) {
      const checkBtn = page.getByRole('button', { name: /check my answer/i });
      if (await checkBtn.isVisible()) break;
      const next = page.getByRole('button', { name: /next|next →|i'm ready|got it|done|next step/i }).first();
      if (await next.isVisible()) {
        await next.click();
        advances++;
        await page.waitForTimeout(400);
      } else break;
    }

    // Should eventually see guided try (input + Check) or celebration
    const hasGuided = await page.getByRole('button', { name: /check my answer/i }).isVisible();
    const hasCelebration = await page.getByText(/you did it|brain just got stronger/i).isVisible();
    expect(hasGuided || hasCelebration).toBe(true);
  });
});
