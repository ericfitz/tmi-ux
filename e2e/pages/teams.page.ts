import { Page } from '@playwright/test';

export class TeamsPage {
  constructor(private page: Page) {}

  readonly searchInput = () => this.page.getByTestId('teams-search-input');
  readonly closeButton = () => this.page.getByTestId('teams-close-button');
  readonly addButton = () => this.page.getByTestId('teams-add-button');
  readonly table = () => this.page.getByTestId('teams-table');
  readonly teamRows = () => this.page.getByTestId('teams-row');
  readonly paginator = () => this.page.getByTestId('teams-paginator');

  /**
   * Finds a team row by exact name match on the name cell. Substring
   * match on the whole row would match "Foo" against "Foo Updated",
   * breaking rename-verification assertions.
   */
  teamRow(name: string) {
    return this.teamRows().filter({
      has: this.page.getByTestId('teams-row-name').getByText(name, { exact: true }),
    });
  }

  editButton(name: string) {
    return this.teamRow(name).getByTestId('teams-edit-button');
  }

  membersButton(name: string) {
    return this.teamRow(name).getByTestId('teams-members-button');
  }

  moreButton(name: string) {
    return this.teamRow(name).getByTestId('teams-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('teams-responsible-parties-item');

  readonly relatedTeamsItem = () => this.page.getByTestId('teams-related-teams-item');

  readonly metadataItem = () => this.page.getByTestId('teams-metadata-item');

  readonly deleteItem = () => this.page.getByTestId('teams-delete-item');
}
