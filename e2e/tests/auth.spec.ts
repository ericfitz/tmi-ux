import { test, expect } from '@playwright/test';
import { setupMockAuth, clearAuth, loginWithLocalProvider, verifyAuthenticated } from '../helpers/auth';

/**
 * Authentication flow tests
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should login with local provider', async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/');

    // Navigate to threat models - should work with mock auth
    await page.goto('/tm');
    await expect(page).toHaveURL(/\/tm/);

    // Verify authenticated
    const isAuthenticated = await verifyAuthenticated(page);
    expect(isAuthenticated).toBe(true);
  });

  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/tm');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login page should have login button
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/tm');

    // Verify we're on the threat models page
    await expect(page).toHaveURL(/\/tm/);

    // Reload the page
    await page.reload();

    // Should still be authenticated and on threat models page
    await expect(page).toHaveURL(/\/tm/);
    const isAuthenticated = await verifyAuthenticated(page);
    expect(isAuthenticated).toBe(true);
  });

  test('should handle session expiration', async ({ page }) => {
    await setupMockAuth(page);
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
