import { Page } from '@playwright/test';

// SEM@79b59c8cc0b7e1d6769695f656d86291a856d936: page object exposing locators for the admin users management page (pure)
export class AdminUsersPage {
  // SEM@79b59c8cc0b7e1d6769695f656d86291a856d936: bind a Playwright page instance to the admin users page object (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('users-close-button');
  readonly filterInput = () => this.page.getByTestId('users-filter-input');
  readonly automationToggle = () => this.page.getByTestId('users-automation-toggle');
  readonly createAutomationButton = () => this.page.getByTestId('users-create-automation-button');
  readonly table = () => this.page.getByTestId('users-table');
  readonly paginator = () => this.page.getByTestId('users-paginator');

  readonly rows = () => this.page.getByTestId('users-row');
  // SEM@79b59c8cc0b7e1d6769695f656d86291a856d936: locate a user table row matching the given identifier (pure)
  row(identifier: string) {
    return this.rows().filter({ hasText: identifier });
  }

  // SEM@79b59c8cc0b7e1d6769695f656d86291a856d936: locate the manage credentials action button for a named user row (pure)
  manageCredentialsButton(identifier: string) {
    return this.row(identifier).getByTestId('users-manage-credentials-button');
  }
  // SEM@79b59c8cc0b7e1d6769695f656d86291a856d936: locate the overflow menu button for a named user row (pure)
  moreButton(identifier: string) {
    return this.row(identifier).getByTestId('users-more-button');
  }

  readonly transferOwnershipItem = () => this.page.getByTestId('users-transfer-ownership-item');
  readonly deleteItem = () => this.page.getByTestId('users-delete-item');
}
