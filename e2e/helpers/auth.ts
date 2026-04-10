import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/**
 * Login using the TMI OAuth provider.
 *
 * Navigates to /login, clicks the configured OAuth provider button,
 * and waits for the redirect chain to complete. The httpOnly session
 * cookie is automatically stored in the Page's BrowserContext.
 */
export async function loginWithTmiProvider(page: Page): Promise<void> {
  await page.goto('/login');

  // Wait for provider button to be visible and enabled
  const providerButton = page.locator(
    `button[data-provider="${testConfig.testOAuthProvider}"]`,
  );
  await providerButton.waitFor({ state: 'visible', timeout: 10000 });

  // Click and wait for the full OAuth redirect chain to complete:
  // login -> backend OAuth -> IdP (auto-grant for tmi) -> callback -> final destination
  await Promise.all([
    page.waitForURL(
      url =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/oauth2/callback'),
      { timeout: 15000 },
    ),
    providerButton.click(),
  ]);
}
