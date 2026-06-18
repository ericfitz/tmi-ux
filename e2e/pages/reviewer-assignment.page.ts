import { Page } from '@playwright/test';

// SEM@2ec44885144e6f679eace25e5ddb6c574a3dae6e: Playwright page object exposing locators for the reviewer assignment triage view (pure)
export class ReviewerAssignmentPage {
  // SEM@2ec44885144e6f679eace25e5ddb6c574a3dae6e: bind Playwright page instance to the page object (pure)
  constructor(private page: Page) {}

  readonly searchInput = () =>
    this.page.getByTestId('reviewer-assignment-search-input');
  readonly statusFilter = () =>
    this.page.getByTestId('reviewer-assignment-status-filter');
  readonly unassignedCheckbox = () =>
    this.page.getByTestId('reviewer-assignment-unassigned-checkbox');
  readonly moreFiltersButton = () =>
    this.page.getByTestId('reviewer-assignment-more-filters-button');
  readonly clearFiltersButton = () =>
    this.page.getByTestId('reviewer-assignment-clear-filters-button');
  readonly tmRows = () =>
    this.page.getByTestId('reviewer-assignment-row');
  readonly tmRow = (name: string) =>
    this.tmRows().filter({ hasText: name });
  readonly reviewerSelect = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-reviewer-select');
  readonly assignButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-assign-button');
  readonly assignMeButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-assign-me-button');
  readonly openTmButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-open-tm-button');
  readonly paginator = () =>
    this.page.getByTestId('reviewer-assignment-paginator');
}
