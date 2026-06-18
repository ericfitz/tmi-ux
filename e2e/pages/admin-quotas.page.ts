import { Page } from '@playwright/test';

// SEM@093cfcb88a20d36aba41df6b5d10dd0c89e3a063: page object exposing locators for the admin quotas management UI
export class AdminQuotasPage {
  // SEM@093cfcb88a20d36aba41df6b5d10dd0c89e3a063: build page object bound to a Playwright page instance (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('quotas-close-button');
  readonly usersSection = () => this.page.getByTestId('quotas-users-section');
  readonly webhooksSection = () => this.page.getByTestId('quotas-webhooks-section');
  readonly usersAddButton = () => this.page.getByTestId('quotas-users-add-button');

  readonly addQuotaCancelButton = () => this.page.getByTestId('add-quota-cancel-button');
  readonly addQuotaSubmitButton = () => this.page.getByTestId('add-quota-submit-button');
}
