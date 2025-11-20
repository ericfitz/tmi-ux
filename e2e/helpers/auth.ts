import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';
import { getFreshOAuthCredentials } from './oauth-credentials';

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
 * Gets fresh credentials for each test run
 */
export async function loginWithTestProvider(page: Page): Promise<void> {
  // Get fresh OAuth credentials using the configured test provider
  await getFreshOAuthCredentials(page);

  // Verify we were redirected away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: testConfig.authTimeout
  });

  // Verify auth token is in localStorage
  const hasToken = await page.evaluate(() => {
    const token = localStorage.getItem('auth_token');
    return token !== null && token.length > 0;
  });

  if (!hasToken) {
    throw new Error('OAuth flow completed but no auth token was stored');
  }
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
