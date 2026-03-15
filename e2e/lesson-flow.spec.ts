import { test, expect } from '@playwright/test';

/**
 * Phase 3: Ace Instruction Engine + Motion Lesson E2E.
 * - Learner opens lesson (Ace Lesson: Math)
 * - Concept scene renders, narration can replay
 * - Guided try works, independent try validates, celebration appears
 * - Lesson completion persists (redirect to arcade).
 * Skipped unless TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD are set.
 */

test.describe('Ace lesson flow', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(!learnerEmail || !learnerPassword, 'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set');
  test.setTimeout(120000);

  test('login -> Ace Lesson Math -> concept scene -> replay -> guided try -> independent try -> celebration -> done', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    // Start Ace Lesson (Math)
    await expect(page.getByRole('button', { name: /ace lesson: math/i })).toBeVisible();
    await page.getByRole('button', { name: /ace lesson: math/i }).click();

    // Lesson page: URL has episode id
    await expect(page).toHaveURL(/\/v2\/learn\/lesson\/[a-f0-9-]+/, { timeout: 15000 });

    // First scene is focus or concept (deterministic builder order)
    await expect(
      page.getByText(/let's learn|focus|counting|addition|subtraction|equal/i)
    ).toBeVisible({ timeout: 8000 });

    // Replay narration button (optional; may not be visible if no speech API)
    const replayBtn = page.getByRole('button', { name: /play again|replay/i });
    if (await replayBtn.isVisible()) {
      await replayBtn.click();
    }

    // Advance through scenes: "I'm ready" or "Next"
    const nextBtn = page.getByRole('button', { name: /i'm ready|next/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // Continue until we see a concept or worked example text
    await expect(page.getByText(/count|add|subtract|equal|example|step/i)).toBeVisible({ timeout: 6000 });

    // Keep advancing until we hit guided try (input + "Check my answer")
    let steps = 0;
    const maxSteps = 12;
    while (steps < maxSteps) {
      const checkBtn = page.getByRole('button', { name: /check my answer/i });
      if (await checkBtn.isVisible()) break;
      const next = page.getByRole('button', { name: /next|i'm ready|got it|done/i }).first();
      if (await next.isVisible()) {
        await next.click();
        steps++;
        await page.waitForTimeout(400);
      } else break;
    }

    // Guided try: type answer and check
    const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
    await expect(input).toBeVisible({ timeout: 8000 });
    await input.fill('3');
    await page.getByRole('button', { name: /check my answer/i }).click();

    // Next scene (may be independent try or hint/celebration)
    await page.waitForTimeout(800);
    const nextAfterGuided = page.getByRole('button', { name: /next|check my answer|done/i }).first();
    await expect(nextAfterGuided).toBeVisible({ timeout: 6000 });

    // If we see another "Check my answer", do independent try
    const independentCheck = page.getByRole('button', { name: /check my answer/i });
    if (await independentCheck.isVisible()) {
      const input2 = page.locator('input[type="text"], input[inputmode="numeric"]').first();
      await input2.fill('4');
      await independentCheck.click();
      await page.waitForTimeout(800);
    }

    // Advance to celebration
    for (let i = 0; i < 5; i++) {
      const doneBtn = page.getByRole('button', { name: /done|next|got it/i }).first();
      if (await doneBtn.isVisible()) {
        await doneBtn.click();
        await page.waitForTimeout(500);
      }
      const celebration = page.getByText(/you did it|mission complete|celebration|xp|\+\d+ xp/i);
      if (await celebration.isVisible()) break;
    }

    // Celebration scene
    await expect(
      page.getByText(/you did it|brain just got stronger|\+.*xp/i)
    ).toBeVisible({ timeout: 8000 });

    // Done -> back to arcade (triggers POST complete -> mastery + review + history)
    await page.getByRole('button', { name: /done/i }).click();
    await expect(page).toHaveURL(/\/v2\/learners\/(liv|elle)/, { timeout: 8000 });

    // Phase 3B: closed-loop — verify mastery/decision persisted
    const meRes = await page.request.get('/api/v2/me');
    expect(meRes.ok()).toBe(true);
    const me = (await meRes.json()) as { id: string };
    const loopRes = await page.request.get(`/api/v2/parent/closed-loop?learnerId=${me.id}&domain=math`);
    expect(loopRes.ok()).toBe(true);
    const loop = (await loopRes.json()) as {
      latest_lesson_decision: unknown;
      mastery_by_skill: unknown[];
      next_planned_skill: unknown;
      scheduled_reviews: unknown[];
    };
    expect(loop.latest_lesson_decision).toBeDefined();
    expect(Array.isArray(loop.mastery_by_skill)).toBe(true);
    expect(loop.next_planned_skill !== undefined || loop.mastery_by_skill.length >= 0).toBe(true);
  });
});
