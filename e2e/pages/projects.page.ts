import { Page } from '@playwright/test';

export class ProjectsPage {
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
  projectRow(name: string) {
    return this.projectRows().filter({
      has: this.page.getByTestId('projects-row-name').getByText(name, { exact: true }),
    });
  }

  editButton(name: string) {
    return this.projectRow(name).getByTestId('projects-edit-button');
  }

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
