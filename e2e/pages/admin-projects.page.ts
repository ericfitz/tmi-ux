import { Page } from '@playwright/test';

// SEM@6530b75ece9303425c632129eb9d7311de59d92b: page object exposing locators for the admin projects management UI
export class AdminProjectsPage {
  // SEM@6530b75ece9303425c632129eb9d7311de59d92b: build page object bound to a Playwright page instance (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('projects-close-button');
  readonly nameFilter = () => this.page.getByTestId('projects-name-filter');
  readonly teamFilter = () => this.page.getByTestId('projects-team-filter');
  readonly teamFilterClear = () => this.page.getByTestId('projects-team-filter-clear');
  readonly statusFilter = () => this.page.getByTestId('projects-status-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('projects-clear-filters-button');
  readonly addButton = () => this.page.getByTestId('projects-add-button');
  readonly table = () => this.page.getByTestId('projects-table');
  readonly paginator = () => this.page.getByTestId('projects-paginator');

  readonly rows = () => this.page.getByTestId('projects-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  // SEM@6530b75ece9303425c632129eb9d7311de59d92b: locate the edit action button for a named project row (pure)
  editButton(name: string) {
    return this.row(name).getByTestId('projects-edit-button');
  }

  // SEM@6530b75ece9303425c632129eb9d7311de59d92b: locate the overflow menu button for a named project row (pure)
  moreButton(name: string) {
    return this.row(name).getByTestId('projects-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('projects-responsible-parties-item');
  readonly relatedProjectsItem = () => this.page.getByTestId('projects-related-projects-item');
  readonly metadataItem = () => this.page.getByTestId('projects-metadata-item');
  readonly deleteItem = () => this.page.getByTestId('projects-delete-item');
}
