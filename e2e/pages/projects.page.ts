import { Page } from '@playwright/test';

// SEM@317e7eace5680fd59d8903cf838f9255699f65b7: Playwright page object exposing locators and row helpers for the projects list (pure)
export class ProjectsPage {
  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: bind Playwright page instance to the page object (pure)
  constructor(private page: Page) {}

  readonly nameFilter = () => this.page.getByTestId('projects-name-filter');
  readonly teamFilter = () => this.page.getByTestId('projects-team-filter');
  readonly teamFilterClear = () => this.page.getByTestId('projects-team-filter-clear');
  readonly statusFilter = () => this.page.getByTestId('projects-status-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('projects-clear-filters-button');
  readonly closeButton = () => this.page.getByTestId('projects-close-button');
  readonly addButton = () => this.page.getByTestId('projects-add-button');
  readonly table = () => this.page.getByTestId('projects-table');
  readonly projectRows = () => this.page.getByTestId('projects-row');
  readonly paginator = () => this.page.getByTestId('projects-paginator');

  /**
   * Finds a project row by exact name match on the name cell. Substring
   * match on the whole row would match "Foo" against "Foo Updated",
   * breaking rename-verification assertions.
   */
  // SEM@317e7eace5680fd59d8903cf838f9255699f65b7: locate a project table row by exact project name match (pure)
  projectRow(name: string) {
    return this.projectRows().filter({
      has: this.page.getByTestId('projects-row-name').getByText(name, { exact: true }),
    });
  }

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate the edit action button for a named project row (pure)
  editButton(name: string) {
    return this.projectRow(name).getByTestId('projects-edit-button');
  }

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate the more-menu button for a named project row (pure)
  moreButton(name: string) {
    return this.projectRow(name).getByTestId('projects-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('projects-responsible-parties-item');

  readonly relatedProjectsItem = () =>
    this.page.getByTestId('projects-related-projects-item');

  readonly metadataItem = () => this.page.getByTestId('projects-metadata-item');

  readonly deleteItem = () => this.page.getByTestId('projects-delete-item');
}
