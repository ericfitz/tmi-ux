import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

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

    await this.page.waitForURL(
      url =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/oauth2/callback'),
      { timeout: 30000 },
    );
  }
}
