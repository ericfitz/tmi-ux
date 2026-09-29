import { Page } from '@playwright/test';

// SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: page object exposing locators for the admin surveys management page (pure)
export class AdminSurveysPage {
  // SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: bind a Playwright page instance to the admin surveys page object (pure)
  constructor(private page: Page) {}

  readonly searchInput = () =>
    this.page.getByTestId('admin-surveys-search-input');
  readonly statusFilter = () =>
    this.page.getByTestId('admin-surveys-status-filter');
  readonly createButton = () =>
    this.page.getByTestId('admin-surveys-create-button');
  readonly surveyRows = () =>
    this.page.getByTestId('admin-surveys-row');
  readonly surveyRow = (name: string) =>
    this.surveyRows().filter({ hasText: name });
  /** Rows whose name cell equals `name` exactly (not a substring such as "<name> (Copy)"). */
  readonly surveyRowExact = (name: string) =>
    this.surveyRows().filter({
      has: this.page.locator('.template-name', {
        hasText: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`),
      }),
    });
  readonly editButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-edit-button');
  readonly toggleStatusButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-toggle-status-button');
  readonly moreButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-more-button');
  readonly cloneItem = () =>
    this.page.getByTestId('admin-surveys-clone-item');
  readonly archiveItem = () =>
    this.page.getByTestId('admin-surveys-archive-item');
  readonly deleteItem = () =>
    this.page.getByTestId('admin-surveys-delete-item');
}
