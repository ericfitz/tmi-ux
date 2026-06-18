import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { testConfig } from '../config/test.config';

// SEM@cbe04d1beae39fd5d2c0e2717ee7a1eddf67271c: E2E flow for authenticating a test user via OAuth login
export class AuthFlow {
  private loginPage: LoginPage;

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: initialize login page reference for auth flow
  constructor(private page: Page) {
    this.loginPage = new LoginPage(page);
  }

  // SEM@cbe04d1beae39fd5d2c0e2717ee7a1eddf67271c: authenticate as a test user and wait for OAuth redirect to complete
  async loginAs(userId: string): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });

    await this.loginPage.providerButton().waitFor({ state: 'visible', timeout: 30000 });
    await this.loginPage.providerButton().click();

    // Dialog appears — type the login hint to select the test user
    await this.loginPage.loginHintInput().waitFor({ state: 'visible', timeout: 5000 });
    await this.loginPage.loginHintInput().fill(userId);
    await this.loginPage.signInButton().waitFor({ state: 'visible', timeout: 5000 });
    await this.loginPage.signInButton().click();

    // Wait for the OAuth flow to complete and return to the app.
    // The flow redirects through the server's /oauth2/authorize endpoint
    // (different origin), so we must wait until the URL is back on the
    // app origin AND not on /login or /oauth2/callback.
    const appOrigin = new URL(testConfig.appUrl).origin;
    await this.page.waitForURL(
      url => {
        const u = new URL(url);
        return (
          u.origin === appOrigin &&
          !u.pathname.includes('/login') &&
          !u.pathname.includes('/oauth2/callback')
        );
      },
      { timeout: 30000 },
    );
  }
}
