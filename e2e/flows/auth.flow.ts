import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { testConfig } from '../config/test.config';

export class AuthFlow {
  private loginPage: LoginPage;

  constructor(private page: Page) {
    this.loginPage = new LoginPage(page);
  }

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
