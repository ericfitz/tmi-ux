import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  readonly createTmButton = () =>
    this.page.getByTestId('create-threat-model-button');

  readonly tmCards = () =>
    this.page.getByTestId('threat-model-card');

  tmCard(name: string) {
    return this.tmCards().filter({ hasText: name });
  }

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

  tableRow(name: string) {
    return this.tableRows().filter({ hasText: name });
  }
}
