import { Page } from '@playwright/test';

export class AdminTeamsPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('teams-close-button');
  readonly searchInput = () => this.page.getByTestId('teams-search-input');
  readonly addButton = () => this.page.getByTestId('teams-add-button');
  readonly table = () => this.page.getByTestId('teams-table');
  readonly paginator = () => this.page.getByTestId('teams-paginator');

  readonly rows = () => this.page.getByTestId('teams-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  editButton(name: string) {
    return this.row(name).getByTestId('teams-edit-button');
  }

  membersButton(name: string) {
    return this.row(name).getByTestId('teams-members-button');
  }

  moreButton(name: string) {
    return this.row(name).getByTestId('teams-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('teams-responsible-parties-item');
  readonly relatedTeamsItem = () => this.page.getByTestId('teams-related-teams-item');
  readonly metadataItem = () => this.page.getByTestId('teams-metadata-item');
  readonly deleteItem = () => this.page.getByTestId('teams-delete-item');
}
