import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../helpers/auth';

/**
 * Smoke tests - Quick validation that the application loads and core functionality works
 */

test.describe('Smoke Tests', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TMI/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load the threat models page with authentication', async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/tm');

    // Should not redirect to login
    await expect(page).toHaveURL(/\/tm/);

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/tm');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });
});
