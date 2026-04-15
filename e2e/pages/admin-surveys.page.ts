import { Page } from '@playwright/test';

export class AdminSurveysPage {
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
