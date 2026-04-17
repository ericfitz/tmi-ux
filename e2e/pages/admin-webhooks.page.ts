import { Page } from '@playwright/test';

export class AdminWebhooksPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('webhooks-close-button');
  readonly filterInput = () => this.page.getByTestId('webhooks-filter-input');
  readonly addButton = () => this.page.getByTestId('webhooks-add-button');
  readonly list = () => this.page.getByTestId('webhooks-list');
  readonly paginator = () => this.page.getByTestId('webhooks-paginator');

  readonly rows = () => this.page.getByTestId('webhooks-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  moreButton(name: string) {
    return this.row(name).getByTestId('webhooks-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('webhooks-delete-item');
}
