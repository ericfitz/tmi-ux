import { Page } from '@playwright/test';

export class AdminQuotasPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('quotas-close-button');
  readonly usersSection = () => this.page.getByTestId('quotas-users-section');
  readonly webhooksSection = () => this.page.getByTestId('quotas-webhooks-section');
  readonly usersAddButton = () => this.page.getByTestId('quotas-users-add-button');

  readonly addQuotaCancelButton = () => this.page.getByTestId('add-quota-cancel-button');
  readonly addQuotaSubmitButton = () => this.page.getByTestId('add-quota-submit-button');
}
