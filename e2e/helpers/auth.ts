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
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Wait for provider button to be visible and enabled.
  // The login component fetches providers from the backend asynchronously,
  // so the button may not appear immediately after page load.
  const providerButton = page.locator(
    `button[data-provider="${testConfig.testOAuthProvider}"]`,
  );
  await providerButton.waitFor({ state: 'visible', timeout: 30000 });

  // Click the provider button — this opens the TMI provider sign-in dialog
  await providerButton.click();

  // The TMI provider shows an interactive dialog with a "Sign In" button.
  // Click it to complete the OAuth flow (username is optional).
  const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
  await signInButton.waitFor({ state: 'visible', timeout: 5000 });
  await signInButton.click();

  // Wait for the full redirect chain to settle on a non-login page
  await page.waitForURL(
    url =>
      !url.pathname.includes('/login') &&
      !url.pathname.includes('/oauth2/callback'),
    { timeout: 30000 },
  );
}
