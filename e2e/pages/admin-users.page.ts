import { Page } from '@playwright/test';

export class AdminUsersPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('users-close-button');
  readonly filterInput = () => this.page.getByTestId('users-filter-input');
  readonly automationToggle = () => this.page.getByTestId('users-automation-toggle');
  readonly createAutomationButton = () => this.page.getByTestId('users-create-automation-button');
  readonly table = () => this.page.getByTestId('users-table');
  readonly paginator = () => this.page.getByTestId('users-paginator');

  readonly rows = () => this.page.getByTestId('users-row');
  row(identifier: string) {
    return this.rows().filter({ hasText: identifier });
  }

  manageCredentialsButton(identifier: string) {
    return this.row(identifier).getByTestId('users-manage-credentials-button');
  }
  moreButton(identifier: string) {
    return this.row(identifier).getByTestId('users-more-button');
  }

  readonly transferOwnershipItem = () => this.page.getByTestId('users-transfer-ownership-item');
  readonly deleteItem = () => this.page.getByTestId('users-delete-item');
}
