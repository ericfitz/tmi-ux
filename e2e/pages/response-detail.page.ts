import { Page } from '@playwright/test';

// SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: Playwright page object exposing locators for the survey response detail view (pure)
export class ResponseDetailPage {
  // SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: bind Playwright page instance to the page object (pure)
  constructor(private page: Page) {}

  readonly closeButton = () =>
    this.page.getByTestId('response-detail-close-button');
  readonly status = () =>
    this.page.getByTestId('response-detail-status');
  readonly tmLink = () =>
    this.page.getByTestId('response-detail-tm-link');
}
