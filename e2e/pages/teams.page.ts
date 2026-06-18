import { Page } from '@playwright/test';

// SEM@317e7eace5680fd59d8903cf838f9255699f65b7: Playwright page object exposing locators and row helpers for the teams list (pure)
export class TeamsPage {
  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: bind the Playwright page for the teams page object (pure)
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
  // SEM@317e7eace5680fd59d8903cf838f9255699f65b7: filter team rows to an exact name match (pure)
  teamRow(name: string) {
    return this.teamRows().filter({
      has: this.page.getByTestId('teams-row-name').getByText(name, { exact: true }),
    });
  }

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate the edit action button for a named team row (pure)
  editButton(name: string) {
    return this.teamRow(name).getByTestId('teams-edit-button');
  }

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate the members action button for a named team row (pure)
  membersButton(name: string) {
    return this.teamRow(name).getByTestId('teams-members-button');
  }

  // SEM@d6418ee027793dbc6ded296657f26e3651ccaf29: locate the overflow menu button for a named team row (pure)
  moreButton(name: string) {
    return this.teamRow(name).getByTestId('teams-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('teams-responsible-parties-item');

  readonly relatedTeamsItem = () => this.page.getByTestId('teams-related-teams-item');

  readonly metadataItem = () => this.page.getByTestId('teams-metadata-item');

  readonly deleteItem = () => this.page.getByTestId('teams-delete-item');
}
