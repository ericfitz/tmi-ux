import { Page } from '@playwright/test';

export class AdminProjectsPage {
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

  editButton(name: string) {
    return this.row(name).getByTestId('projects-edit-button');
  }

  moreButton(name: string) {
    return this.row(name).getByTestId('projects-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('projects-responsible-parties-item');
  readonly relatedProjectsItem = () => this.page.getByTestId('projects-related-projects-item');
  readonly metadataItem = () => this.page.getByTestId('projects-metadata-item');
  readonly deleteItem = () => this.page.getByTestId('projects-delete-item');
}
