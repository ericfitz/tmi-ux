import { Page } from '@playwright/test';

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
 * Set up authentication in localStorage
 * Must be called before navigating to the application
 */
export async function setupMockAuth(page: Page): Promise<void> {
  // Use context storage to set localStorage before page loads
  await page.context().addInitScript(() => {
    // Set authentication token
    const mockAuthToken = {
      token: 'mock.jwt.token',
      expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    localStorage.setItem('auth_token', JSON.stringify(mockAuthToken));

    // Set user profile
    const mockUserProfile = {
      email: 'user1@example.com',
      name: 'user1',
    };
    localStorage.setItem('user_profile', JSON.stringify(mockUserProfile));
  });
}

/**
 * Clear authentication state
 * Safely clears localStorage/sessionStorage by first navigating to the app
 */
export async function clearAuth(page: Page): Promise<void> {
  // Navigate to the app first to ensure we have access to localStorage
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Login using the local provider UI
 */
export async function loginWithLocalProvider(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Click "Login as User1" button
  await page.getByRole('button', { name: /login.*user1/i }).click();

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });
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
