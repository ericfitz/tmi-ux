import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

export class LoginPage {
  constructor(private page: Page) {}

  readonly providerButton = () =>
    this.page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`);

  readonly loginHintInput = () => this.page.getByLabel('Username');

  readonly signInButton = () =>
    this.page.getByRole('button', { name: 'Sign In', exact: true });
}
