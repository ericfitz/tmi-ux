import { Page } from '@playwright/test';

// SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: page object exposing locators for the admin webhooks management page (pure)
export class AdminWebhooksPage {
  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: bind a Playwright page instance to the admin webhooks page object (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('webhooks-close-button');
  readonly filterInput = () => this.page.getByTestId('webhooks-filter-input');
  readonly addButton = () => this.page.getByTestId('webhooks-add-button');
  readonly list = () => this.page.getByTestId('webhooks-list');
  readonly paginator = () => this.page.getByTestId('webhooks-paginator');

  readonly rows = () => this.page.getByTestId('webhooks-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: locate the overflow menu button for a named webhook row (pure)
  moreButton(name: string) {
    return this.row(name).getByTestId('webhooks-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('webhooks-delete-item');
}
