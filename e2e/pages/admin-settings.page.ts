import { Page } from '@playwright/test';

export class AdminSettingsPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('settings-close-button');
  readonly filterInput = () => this.page.getByTestId('settings-filter-input');
  readonly addButton = () => this.page.getByTestId('settings-add-button');
  readonly table = () => this.page.getByTestId('settings-table');
  readonly paginator = () => this.page.getByTestId('settings-paginator');

  readonly rows = () => this.page.getByTestId('settings-row');
  readonly row = (key: string) => this.rows().filter({ hasText: key });

  editButton(key: string) {
    return this.row(key).getByTestId('settings-edit-button');
  }

  moreButton(key: string) {
    return this.row(key).getByTestId('settings-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('settings-delete-item');
}
