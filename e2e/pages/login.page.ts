import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

// SEM@18e6c69b6122b7bb2baa5db454bb171f8b7d1e1c: page object exposing OAuth provider selection and sign-in form locators
export class LoginPage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: store the Playwright page reference for use by locator accessors (pure)
  constructor(private page: Page) {}

  readonly providerButton = () =>
    this.page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`);

  readonly loginHintInput = () => this.page.getByLabel('Username');

  readonly signInButton = () =>
    this.page.getByRole('button', { name: 'Sign In', exact: true });
}
