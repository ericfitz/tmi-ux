import { Page } from '@playwright/test';

// SEM@2ec44885144e6f679eace25e5ddb6c574a3dae6e: Playwright page object exposing triage list view locators and actions (pure)
export class TriagePage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the Playwright page for the triage list page object (pure)
  constructor(private page: Page) {}

  readonly searchInput = () => this.page.getByTestId('triage-search-input');
  readonly statusFilter = () => this.page.getByTestId('triage-status-filter');
  readonly templateFilter = () => this.page.getByTestId('triage-template-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('triage-clear-filters-button');
  readonly responseRows = () => this.page.getByTestId('triage-response-row');
  readonly retryButton = () => this.page.getByTestId('triage-error-retry-button');
  readonly viewButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-view-button');
  readonly approveButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-approve-button');
  readonly revisionButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-revision-button');
  readonly createTmButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-create-tm-button');
  readonly paginator = () => this.page.getByTestId('triage-paginator');
  readonly tabGroup = () => this.page.getByTestId('triage-tab-group');
  readonly responsesTab = () => this.page.getByTestId('triage-responses-tab');
  readonly assignmentTab = () => this.page.getByTestId('triage-assignment-tab');
}
