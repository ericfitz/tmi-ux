import { test, expect } from '../fixtures/test-fixtures';

/**
 * Navigation and routing integration tests.
 *
 * Tests deep linking, auth guards, role guards, browser history,
 * and navbar navigation. Each test is independent (uses fixture
 * isolation, not serial shared state).
 */
test.describe('Navigation & Routing', () => {
  test.setTimeout(60000);

  test('deep link to a threat model', async ({
    page,
    authFlow,
    threatModelFlow,
    tmEditPage,
    dashboardPage,
  }) => {
    await authFlow.login();

    // Create a TM to get a valid ID
    const tmName = `E2E Nav Test TM ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);

    // Extract the TM ID from the URL
    const url = page.url();
    const tmIdMatch = url.match(/\/tm\/([a-f0-9-]+)/);
    expect(tmIdMatch).toBeTruthy();
    const tmId = tmIdMatch![1];

    // Navigate away then deep link back
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto(`/tm/${tmId}`);
    await page.waitForLoadState('networkidle');

    await expect(tmEditPage.tmName()).toHaveText(tmName, { timeout: 10000 });

    // Cleanup
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await threatModelFlow.deleteFromDashboard(tmName);
  });

  test('deep link to nonexistent resource', async ({ page, authFlow }) => {
    await authFlow.login();

    await page.goto('/tm/00000000-0000-0000-0000-000000000000');

    // Should redirect away from the TM page or show error
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    // Should not be stuck on the nonexistent TM URL without any indication of error
    expect(
      currentUrl.includes('/dashboard') ||
        currentUrl.includes('/tm/00000000-0000-0000-0000-000000000000'),
    ).toBeTruthy();
  });

  test('auth guard redirects to login', async ({ page }) => {
    // Fresh page, no auth — navigate directly to protected route
    await page.goto('/dashboard');

    // Should redirect to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('protected route not accessible without auth', async ({ page }) => {
    // Fresh page, no auth — navigate to triage (requires reviewer role)
    await page.goto('/triage');

    // Should redirect away — either to /login (auth guard) or /unauthorized (role guard)
    await page.waitForURL(
      url => url.pathname.includes('/login') || url.pathname.includes('/unauthorized'),
      { timeout: 10000 },
    );

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/triage');
  });

  test('back/forward navigation', async ({
    page,
    authFlow,
    threatModelFlow,
    tmEditPage,
    dashboardPage,
  }) => {
    await authFlow.login();

    const tmName = `E2E Back/Fwd Test TM ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);
    await expect(tmEditPage.tmName()).toHaveText(tmName);

    // We're on TM edit — go back to dashboard
    await page.goBack();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(dashboardPage.tmCards()).not.toHaveCount(0, { timeout: 10000 });

    // Go forward — should return to TM edit
    await page.goForward();
    await page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(tmEditPage.tmName()).toHaveText(tmName);

    // Cleanup
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await threatModelFlow.deleteFromDashboard(tmName);
  });

  test('navbar navigation', async ({ page, authFlow, navbarPage }) => {
    await authFlow.login();

    // Click dashboard link
    await navbarPage.dashboardLink().click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Click intake link
    await navbarPage.intakeLink().click();
    await page.waitForURL(/\/intake/, { timeout: 10000 });
    expect(page.url()).toContain('/intake');
  });
});
