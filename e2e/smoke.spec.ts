import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Liv|Learning|Arcade/i);
});

test('v2 login page is reachable', async ({ page }) => {
  await page.goto('/v2/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});
