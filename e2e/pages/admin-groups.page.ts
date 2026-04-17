import { Page } from '@playwright/test';

export class AdminGroupsPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('groups-close-button');
  readonly searchInput = () => this.page.getByTestId('groups-search-input');
  readonly addButton = () => this.page.getByTestId('groups-add-button');
  readonly table = () => this.page.getByTestId('groups-table');
  readonly paginator = () => this.page.getByTestId('groups-paginator');

  readonly rows = () => this.page.getByTestId('groups-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  membersButton(name: string) {
    return this.row(name).getByTestId('groups-members-button');
  }

  moreButton(name: string) {
    return this.row(name).getByTestId('groups-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('groups-delete-item');
}
