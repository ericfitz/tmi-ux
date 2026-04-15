import { Page } from '@playwright/test';

export class ResponseDetailPage {
  constructor(private page: Page) {}

  readonly closeButton = () =>
    this.page.getByTestId('response-detail-close-button');
  readonly status = () =>
    this.page.getByTestId('response-detail-status');
  readonly tmLink = () =>
    this.page.getByTestId('response-detail-tm-link');
}
