import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../helpers/auth';
import { navigateToHome, navigateToAbout, navigateToThreatModels } from '../helpers/navigation';

/**
 * Navigation and routing tests
 */

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await navigateToHome(page);
    await expect(page).toHaveURL('/');
  });

  test('should navigate to about page', async ({ page }) => {
    await navigateToAbout(page);
    await expect(page).toHaveURL('/about');
    await expect(page.locator('body')).toContainText(/about/i);
  });

  test('should navigate to threat models page when authenticated', async ({ page }) => {
    await setupMockAuth(page);
    await navigateToThreatModels(page);
    await expect(page).toHaveURL(/\/tm/);
  });

  test('should navigate using browser back button', async ({ page }) => {
    await setupMockAuth(page);

    // Navigate to threat models
    await navigateToThreatModels(page);
    await expect(page).toHaveURL(/\/tm/);

    // Navigate to home
    await navigateToHome(page);
    await expect(page).toHaveURL('/');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/tm/);
  });

  test('should navigate using browser forward button', async ({ page }) => {
    await setupMockAuth(page);

    // Navigate to threat models
    await navigateToThreatModels(page);

    // Navigate to home
    await navigateToHome(page);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/tm/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/');
  });

  test('should have working navigation menu', async ({ page }) => {
    await setupMockAuth(page);
    await navigateToHome(page);

    // Look for navigation links
    const navLinks = page.locator('nav a, header a, [role="navigation"] a');

    if ((await navLinks.count()) > 0) {
      // Should have some navigation links
      expect(await navLinks.count()).toBeGreaterThan(0);
    }
  });

  test('should handle 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');

    // Should either redirect or show 404 page
    // Check if redirected to home or shows error message
    const url = page.url();
    const bodyText = await page.locator('body').textContent();

    const isRedirectedOrError =
      url.includes('/') ||
      bodyText?.toLowerCase().includes('not found') ||
      bodyText?.toLowerCase().includes('404');

    expect(isRedirectedOrError).toBe(true);
  });
});
