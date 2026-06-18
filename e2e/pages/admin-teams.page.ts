import { Page } from '@playwright/test';

// SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: page object exposing locators for the admin teams management page (pure)
export class AdminTeamsPage {
  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: bind a Playwright page instance to the admin teams page object (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('teams-close-button');
  readonly searchInput = () => this.page.getByTestId('teams-search-input');
  readonly addButton = () => this.page.getByTestId('teams-add-button');
  readonly table = () => this.page.getByTestId('teams-table');
  readonly paginator = () => this.page.getByTestId('teams-paginator');

  readonly rows = () => this.page.getByTestId('teams-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: locate the edit action button for a named team row (pure)
  editButton(name: string) {
    return this.row(name).getByTestId('teams-edit-button');
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: locate the members action button for a named team row (pure)
  membersButton(name: string) {
    return this.row(name).getByTestId('teams-members-button');
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: locate the overflow menu button for a named team row (pure)
  moreButton(name: string) {
    return this.row(name).getByTestId('teams-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('teams-responsible-parties-item');
  readonly relatedTeamsItem = () => this.page.getByTestId('teams-related-teams-item');
  readonly metadataItem = () => this.page.getByTestId('teams-metadata-item');
  readonly deleteItem = () => this.page.getByTestId('teams-delete-item');
}
