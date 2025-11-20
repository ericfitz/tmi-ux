import { test, expect } from '@playwright/test';
import { loginWithTestProvider } from '../helpers/auth';

/**
 * Smoke tests - Quick validation that the application loads and core functionality works
 */

test.describe('Smoke Tests', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TMI/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should load threat models page when authenticated', async ({ page }) => {
    await loginWithTestProvider(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/tm/);
    await expect(page.locator('body')).toBeVisible();
  });
});
