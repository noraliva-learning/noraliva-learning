import { test, expect } from '@playwright/test';

/**
 * Phase 4: Work Mat — E2E.
 * - Start Ace Lesson (Math) which includes a manipulative scene with workmat_enabled
 * - Reach the manipulative scene and see Work Mat (toolbar + canvas)
 * - Interact (optional draw) and click Next
 * - Complete lesson; optionally verify workmat_output is persisted (GET episode or closed-loop)
 * Skipped unless TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD are set.
 */

test.describe('Work Mat lesson', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(
    !learnerEmail || !learnerPassword,
    'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set'
  );
  test.setTimeout(120000);

  test('lesson with Work Mat: open -> reach manipulative (Work Mat) -> draw or interact -> Next -> complete', async ({
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

    // Advance until we see "Move the pieces" (manipulative with Work Mat)
    let steps = 0;
    const maxSteps = 15;
    while (steps < maxSteps) {
      const movePieces = page.getByText(/move the pieces/i);
      if (await movePieces.isVisible()) break;
      const nextBtn = page.getByRole('button', { name: /next|i'm ready|got it|done/i }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        steps++;
        await page.waitForTimeout(400);
      } else break;
    }

    // Manipulative scene with Work Mat: canvas container and toolbar (pen, highlighter, etc.)
    const workmatContainer = page.locator('.workmat-canvas-container');
    await expect(workmatContainer).toBeVisible({ timeout: 8000 });

    // Toolbar has at least one tool (e.g. pen or clear)
    const toolbar = page.locator('[class*="workmat"]').first();
    await expect(toolbar).toBeVisible();

    // Optional: draw on canvas (tap/drag on the stage)
    const stage = page.locator('canvas').first();
    if (await stage.isVisible()) {
      const box = await stage.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20);
        await page.mouse.up();
      }
    }

    // Next -> continue lesson
    const nextBtn = page.getByRole('button', { name: /next/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // Advance through guided try, independent try, celebration
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const checkBtn = page.getByRole('button', { name: /check my answer/i });
      if (await checkBtn.isVisible()) {
        const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
        if (await input.isVisible()) await input.fill('3');
        await checkBtn.click();
        continue;
      }
      const next = page.getByRole('button', { name: /next|done|got it/i }).first();
      if (await next.isVisible()) {
        await next.click();
      }
      const celebration = page.getByText(/you did it|celebration/i);
      if (await celebration.isVisible()) break;
    }

    await expect(
      page.getByText(/you did it|brain just got stronger|\+.*xp/i)
    ).toBeVisible({ timeout: 8000 });

    // Complete lesson
    await page.getByRole('button', { name: /done/i }).click();
    await expect(page).toHaveURL(/\/v2\/learners\/(liv|elle)/, { timeout: 8000 });

    // Validation: lesson completed; workmat_output may be in episode (optional assertion)
    const meRes = await page.request.get('/api/v2/me');
    expect(meRes.ok()).toBe(true);
  });
});
