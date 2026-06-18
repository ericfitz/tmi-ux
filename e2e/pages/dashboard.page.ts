import { Page } from '@playwright/test';

// SEM@317e7eace5680fd59d8903cf838f9255699f65b7: page object exposing locators and helpers for the threat model dashboard (pure)
export class DashboardPage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind a Playwright page instance to the dashboard page object (pure)
  constructor(private page: Page) {}

  /**
   * Waits for the dashboard to be interactive. Prefer this over
   * waitForLoadState('networkidle') — the TMI app has persistent polling
   * (SessionManager, token guard, WebSocket) that keeps the network active,
   * so networkidle often doesn't resolve before the Playwright internal
   * timeout.
   */
  // SEM@317e7eace5680fd59d8903cf838f9255699f65b7: wait until the dashboard UI is interactive and ready for test actions
  async waitForReady(timeout = 10000): Promise<void> {
    await this.createTmButton().waitFor({ state: 'visible', timeout });
  }

  readonly createTmButton = () =>
    this.page.getByTestId('create-threat-model-button');

  readonly tmCards = () =>
    this.page.getByTestId('threat-model-card');

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: locate a threat model card matching the given name (pure)
  tmCard(name: string) {
    return this.tmCards().filter({ hasText: name });
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: locate the delete button on a named threat model card (pure)
  tmDeleteButton(name: string) {
    return this.tmCard(name).getByTestId('threat-model-delete-button');
  }

  // Filter locators
  readonly searchInput = () => this.page.getByTestId('dashboard-search-input');
  readonly searchClear = () => this.page.getByTestId('dashboard-search-clear');
  readonly nameFilter = () => this.page.getByTestId('dashboard-name-filter');
  readonly statusFilter = () => this.page.getByTestId('dashboard-status-filter');
  readonly moreFiltersButton = () => this.page.getByTestId('dashboard-more-filters-button');
  readonly clearFiltersButton = () => this.page.getByTestId('dashboard-clear-filters-button');
  readonly descriptionFilter = () => this.page.getByTestId('dashboard-description-filter');
  readonly ownerFilter = () => this.page.getByTestId('dashboard-owner-filter');
  readonly issueUriFilter = () => this.page.getByTestId('dashboard-issue-uri-filter');
  readonly createdAfter = () => this.page.getByTestId('dashboard-created-after');
  readonly createdBefore = () => this.page.getByTestId('dashboard-created-before');
  readonly modifiedAfter = () => this.page.getByTestId('dashboard-modified-after');
  readonly modifiedBefore = () => this.page.getByTestId('dashboard-modified-before');

  // View toggle and table locators
  readonly viewToggle = () => this.page.getByTestId('dashboard-view-toggle');
  readonly table = () => this.page.getByTestId('dashboard-table');
  readonly tableRows = () => this.page.getByTestId('dashboard-table-row');
  readonly paginator = () => this.page.getByTestId('dashboard-paginator');

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate a table row matching the given threat model name (pure)
  tableRow(name: string) {
    return this.tableRows().filter({ hasText: name });
  }
}
