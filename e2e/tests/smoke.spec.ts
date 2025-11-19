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

  test('should load threat models page content', async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/tm');

    // Wait for loading to complete
    await page.waitForLoadState('networkidle');

    // Should not show loading spinner anymore
    const spinner = page.locator('mat-spinner, [class*="spinner"], [class*="loading"]');
    await expect(spinner).not.toBeVisible({ timeout: 10000 });

    // Page should have loaded content (not just blank)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});
