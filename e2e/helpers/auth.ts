import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/**
 * Authentication helper functions for e2e tests
 */

export interface MockAuthToken {
  token: string;
  expiresIn: number;
  expiresAt: string;
}

export interface MockUserProfile {
  email: string;
  name: string;
}

/**
 * Login using the test OAuth provider
 * This uses the actual OAuth flow with the test provider
 */
export async function loginWithTestProvider(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto(`${testConfig.appUrl}/login`);

  // Wait for provider buttons to appear
  await page.waitForSelector('button[data-provider]', { timeout: 10000 });

  // Give Angular time to finish rendering and initialization
  await page.waitForTimeout(1000);

  // Click the login button and wait for all navigation to complete
  // The OAuth flow will: click -> navigate to backend -> backend redirects back -> callback processing
  const loginButton = page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`).first();

  // Wait for navigation to complete after clicking
  await Promise.all([
    // Wait for the page to navigate away from login (to callback page)
    page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: testConfig.authTimeout,
      waitUntil: 'load', // Just wait for page load, not networkidle
    }),
    loginButton.click({ force: true }),
  ]);

  // Wait for callback processing to complete and final navigation to occur
  // The callback page should redirect to the return URL after processing
  await page.waitForURL(
    (url) => !url.pathname.includes('/oauth2/callback') && !url.pathname.includes('/login'),
    {
      timeout: testConfig.authTimeout,
    },
  );

  // Additional wait for token to be processed and stored after navigation completes
  await page.waitForFunction(
    () => {
      const token = localStorage.getItem('auth_token');
      return token !== null && token.length > 0;
    },
    { timeout: 5000 }, // Token should be stored by now
  );
}

/**
 * Clear authentication state
 * Safely clears localStorage/sessionStorage by first navigating to the app
 */
export async function clearAuth(page: Page): Promise<void> {
  // Navigate to the app first to ensure we have access to localStorage
  await page.goto(`${testConfig.appUrl}/`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Login using the local provider UI (alias for loginWithTestProvider)
 */
export async function loginWithLocalProvider(page: Page): Promise<void> {
  await loginWithTestProvider(page);
}

/**
 * Verify user is authenticated
 */
export async function verifyAuthenticated(page: Page): Promise<boolean> {
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  return authToken !== null;
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Look for user menu or logout button
  const userMenuButton = page.getByRole('button', { name: /user|profile|account/i });

  if (await userMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await userMenuButton.click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
  }

  // Wait for redirect to login or home
  await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname === '/', {
    timeout: 5000,
  });
}
