import { test, expect } from '@playwright/test';
import { clearAuth, loginWithTestProvider, verifyAuthenticated } from '../helpers/auth';

/**
 * Authentication flow tests
 * NOTE: These tests require a running backend server
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should login with test provider', async ({ page }) => {
    await loginWithTestProvider(page);

    // Should be redirected to home or threat models page
    await expect(page).not.toHaveURL(/\/login/);

    // Verify authenticated
    const isAuthenticated = await verifyAuthenticated(page);
    expect(isAuthenticated).toBe(true);
  });

  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/tm');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login page should be visible
    await expect(page.locator('body')).toContainText(/sign in/i);
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await loginWithTestProvider(page);

    // Navigate to threat models
    await page.goto('/tm');
    await expect(page).toHaveURL(/\/tm/);

    // Reload the page
    await page.reload();

    // Should still be authenticated and on threat models page
    await expect(page).toHaveURL(/\/tm/);
    const isAuthenticated = await verifyAuthenticated(page);
    expect(isAuthenticated).toBe(true);
  });

  test('should handle session expiration', async ({ page }) => {
    await loginWithTestProvider(page);
    await page.goto('/tm');
    await expect(page).toHaveURL(/\/tm/);

    // Clear auth token to simulate expiration
    await clearAuth(page);

    // Try to navigate to protected route
    await page.goto('/tm');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
