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
 * Get fresh OAuth credentials using the test provider
 * This performs the full OAuth flow in a headless manner
 */
export async function getFreshOAuthCredentials(page: Page): Promise<OAuthCredentials> {
  // Navigate to login page
  await page.goto(`${testConfig.appUrl}/login`);

  // Wait for providers to load
  await page.waitForSelector('.providers-loading', { state: 'hidden', timeout: 15000 }).catch(() => {
    // If there's no spinner, providers already loaded
  });

  // Wait for provider buttons
  await page.waitForSelector('button[data-provider]', { timeout: 15000 });

  // Find the test provider button
  const testProviderButton = page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`);
  const hasTestProvider = (await testProviderButton.count()) > 0;

  if (!hasTestProvider) {
    // Fallback to first available provider
    const allButtons = page.locator('button[data-provider]');
    const count = await allButtons.count();
    if (count === 0) {
      throw new Error('No OAuth providers available on login page');
    }
    await allButtons.first().click();
  } else {
    await testProviderButton.click();
  }

  // Wait for OAuth flow to complete and token to be stored
  await page.waitForFunction(
    () => {
      const token = localStorage.getItem('auth_token');
      return token !== null && token.length > 0;
    },
    { timeout: testConfig.authTimeout },
  );

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
