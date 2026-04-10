import { Page } from '@playwright/test';

export class TriagePage {
  constructor(private page: Page) {}

  readonly searchInput = () => this.page.getByTestId('triage-search-input');
  readonly statusFilter = () => this.page.getByTestId('triage-status-filter');
  readonly templateFilter = () => this.page.getByTestId('triage-template-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('triage-clear-filters-button');
  readonly responseRows = () => this.page.getByTestId('triage-response-row');
  readonly retryButton = () => this.page.getByTestId('triage-error-retry-button');
}
