import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/**
 * OAuth credentials obtained from the test provider
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Get OAuth providers from the backend
 */
async function getOAuthProviders(): Promise<any[]> {
  const response = await fetch(`${testConfig.apiUrl}/oauth2/providers`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OAuth providers: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data.providers || [];
}

/**
 * Get fresh OAuth credentials using the TMI provider
 * This performs the full OAuth flow in a headless manner
 */
export async function getFreshOAuthCredentials(page: Page): Promise<OAuthCredentials> {
  // Navigate to login page
  await page.goto(`${testConfig.appUrl}/login`);

  // Wait for providers to load
  await page.waitForSelector('.providers-loading', { state: 'hidden', timeout: 15000 }).catch(() => {
    // If there's no spinner, providers already loaded
  });

  // Wait for provider buttons to be present and enabled
  await page.waitForSelector('button[data-provider]:not([disabled])', { timeout: 15000 });

  // Find the test provider button
  const testProviderButton = page.locator(
    `button[data-provider="${testConfig.testOAuthProvider}"]:not([disabled])`,
  );
  const hasTestProvider = (await testProviderButton.count()) > 0;

  // Click the provider button and wait for navigation
  // The OAuth flow involves redirects, so we need to wait for the final navigation back to our app
  if (!hasTestProvider) {
    // Fallback to first available enabled provider
    const allButtons = page.locator('button[data-provider]:not([disabled])');
    const count = await allButtons.count();
    if (count === 0) {
      throw new Error('No enabled OAuth providers available on login page');
    }
    // Click and wait for navigation to complete
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: testConfig.authTimeout }),
      allButtons.first().click(),
    ]);
  } else {
    // Click and wait for navigation to complete
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: testConfig.authTimeout }),
      testProviderButton.click(),
    ]);
  }

  // Wait for token to be stored in localStorage after navigation completes
  try {
    await page.waitForFunction(
      () => {
        const token = localStorage.getItem('auth_token');
        return token !== null && token.length > 0;
      },
      { timeout: 5000 }, // Shorter timeout since we've already waited for navigation
    );
  } catch (error) {
    // Capture current URL and localStorage for debugging
    const currentUrl = page.url();
    const hasToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    const oauthState = await page.evaluate(() => localStorage.getItem('oauth_state'));
    const oauthProvider = await page.evaluate(() => localStorage.getItem('oauth_provider'));

    throw new Error(
      `OAuth flow completed but token not stored after 5s. ` +
        `Current URL: ${currentUrl}, ` +
        `Has Token: ${!!hasToken}, ` +
        `OAuth State: ${oauthState}, ` +
        `OAuth Provider: ${oauthProvider}`,
    );
  }

  // Extract token from localStorage
  const tokenData = await page.evaluate(() => {
    return localStorage.getItem('auth_token');
  });

  if (!tokenData) {
    throw new Error('Failed to obtain OAuth credentials');
  }

  // The token is encrypted in localStorage, but for e2e tests we just need
  // to verify it exists. The actual credentials are managed by the browser.
  return {
    accessToken: tokenData,
    tokenType: 'Bearer',
    expiresIn: testConfig.authTimeout / 1000, // Convert to seconds
  };
}

/**
 * Check if a specific OAuth provider is available
 */
export async function isProviderAvailable(providerId: string): Promise<boolean> {
  try {
    const providers = await getOAuthProviders();
    return providers.some((p: any) => p.id === providerId);
  } catch (error) {
    console.error('Failed to check provider availability:', error);
    return false;
  }
}

/**
 * Get information about available OAuth providers
 */
export async function getAvailableProviders(): Promise<any[]> {
  return getOAuthProviders();
}
