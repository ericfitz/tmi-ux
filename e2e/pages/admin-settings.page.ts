import { Page } from '@playwright/test';

// SEM@39232dc427837c46e7571b200bef692d196006d9: page object exposing locators for the admin settings management UI
export class AdminSettingsPage {
  // SEM@39232dc427837c46e7571b200bef692d196006d9: build page object bound to a Playwright page instance (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('settings-close-button');
  readonly filterInput = () => this.page.getByTestId('settings-filter-input');
  readonly addButton = () => this.page.getByTestId('settings-add-button');
  readonly table = () => this.page.getByTestId('settings-table');
  readonly paginator = () => this.page.getByTestId('settings-paginator');

  readonly rows = () => this.page.getByTestId('settings-row');
  readonly row = (key: string) => this.rows().filter({ hasText: key });

  // SEM@39232dc427837c46e7571b200bef692d196006d9: locate the edit action button for a named settings row (pure)
  editButton(key: string) {
    return this.row(key).getByTestId('settings-edit-button');
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: locate the overflow menu button for a named settings row (pure)
  moreButton(key: string) {
    return this.row(key).getByTestId('settings-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('settings-delete-item');
}
