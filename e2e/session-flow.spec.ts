import { test, expect } from '@playwright/test';

/**
 * Phase 2 / AI session flow E2E tests.
 * - Starting a session immediately generates a question (no static plan).
 * - Every answer produces next question (generate-exercise after submit-answer).
 * - Session never ends due to missing content (fallback math when needed).
 * Skipped unless TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD are set.
 * Run with: TEST_LEARNER_EMAIL=liv@... TEST_LEARNER_PASSWORD=... npm run test:e2e
 */

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Liv|Learning|Arcade/i);
});

test('v2 login page is reachable (regression: prod server middleware / edge sandbox)', async ({ page }) => {
  await page.goto('/v2/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});

test.describe('AI session flow', () => {
  const learnerEmail = process.env.TEST_LEARNER_EMAIL;
  const learnerPassword = process.env.TEST_LEARNER_PASSWORD;

  test.skip(!learnerEmail || !learnerPassword, 'TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD must be set');
  test.setTimeout(120000);

  test('login -> start session -> immediately see question -> submit answer -> next question -> repeat', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    await page.goto('/v2/learn');
    await expect(page.getByRole('button', { name: /start session/i })).toBeVisible();
    await page.getByRole('button', { name: /start session/i }).click();

    await expect(page).toHaveURL(/\/v2\/learn\/session\/[a-f0-9-]+/);

    await expect(page.getByText(/question 1/i)).toBeVisible({ timeout: 10000 });
    const loadingOrEmpty = page.getByText(/no content yet|couldn't generate/i);
    await expect(loadingOrEmpty).not.toBeVisible();

    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeVisible();
    await expect(page.locator('input').first()).toBeVisible();

    let answeredCount = 0;
    const maxSteps = 5;
    while (answeredCount < maxSteps) {
      const sessionComplete = page.getByText(/session complete/i);
      const noContent = page.getByText(/no content yet|couldn't generate/i);

      if (await sessionComplete.isVisible()) break;
      if (await noContent.isVisible()) {
        await page.getByRole('button', { name: /end session/i }).click();
        await expect(page).toHaveURL(/\/v2\/learners\/(liv|elle)/);
        break;
      }

      const input = page.locator('input[type="text"], input[inputmode="numeric"]').first();
      if (await input.isVisible()) {
        await input.fill('4');
        await page.getByRole('button', { name: /submit/i }).click();
        answeredCount++;
        // Wait for feedback state: "Next question" button is the stable indicator (only visible after submit-answer returns)
        await expect(page.getByRole('button', { name: /next question/i })).toBeVisible({ timeout: 25000 });
        await page.getByRole('button', { name: /next question/i }).click();
        await expect(page.getByText(/question \d+/i)).toBeVisible({ timeout: 8000 });
      } else {
        const endBtn = page.getByRole('button', { name: /end session/i });
        if (await endBtn.isVisible()) await endBtn.click();
        break;
      }
    }

    expect(answeredCount).toBeGreaterThanOrEqual(1);
    await expect(
      page.getByText(/session complete/i).or(page.getByText(/question \d+/i)).or(page.locator('a[href*="/v2/learners/"]')).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('session never ends due to missing content: multiple answers yield next question each time', async ({
    page,
  }) => {
    await page.goto('/v2/login');
    await page.getByLabel(/email/i).fill(learnerEmail!);
    await page.getByLabel(/password/i).fill(learnerPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(v2\/learners\/liv|v2\/learners\/elle|v2\/parent)/);

    await page.goto('/v2/learn');
    await page.getByRole('button', { name: /start session/i }).click();
    await expect(page).toHaveURL(/\/v2\/learn\/session\/[a-f0-9-]+/);

    await expect(page.getByText(/question 1/i)).toBeVisible({ timeout: 10000 });

    for (let i = 0; i < 3; i++) {
      await page.locator('input').first().fill('3');
      await page.getByRole('button', { name: /submit/i }).click();
      // Wait for feedback state: "Next question" button is the stable indicator
      await expect(page.getByRole('button', { name: /next question/i })).toBeVisible({ timeout: 25000 });
      await page.getByRole('button', { name: /next question/i }).click();
      await expect(page.getByText(new RegExp(`question ${i + 2}`, 'i'))).toBeVisible({ timeout: 8000 });
    }
  });
});
