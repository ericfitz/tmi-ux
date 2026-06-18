import { Page } from '@playwright/test';

// SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: page object exposing locators for the admin groups management UI
export class AdminGroupsPage {
  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: build page object bound to a Playwright page instance (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('groups-close-button');
  readonly searchInput = () => this.page.getByTestId('groups-search-input');
  readonly addButton = () => this.page.getByTestId('groups-add-button');
  readonly table = () => this.page.getByTestId('groups-table');
  readonly paginator = () => this.page.getByTestId('groups-paginator');

  readonly rows = () => this.page.getByTestId('groups-row');
  readonly row = (name: string) => this.rows().filter({ hasText: name });

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: locate the members action button for a named group row (pure)
  membersButton(name: string) {
    return this.row(name).getByTestId('groups-members-button');
  }

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: locate the overflow menu button for a named group row (pure)
  moreButton(name: string) {
    return this.row(name).getByTestId('groups-more-button');
  }

  readonly deleteItem = () => this.page.getByTestId('groups-delete-item');
}
