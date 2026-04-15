import { Page } from '@playwright/test';

export class MyResponsesPage {
  constructor(private page: Page) {}

  readonly statusFilter = () =>
    this.page.getByTestId('my-responses-status-filter');
  readonly closeButton = () =>
    this.page.getByTestId('my-responses-close-button');
  readonly responseRows = () =>
    this.page.getByTestId('my-responses-row');
  readonly responseRow = (name: string) =>
    this.responseRows().filter({ hasText: name });
  readonly editButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-edit-button');
  readonly viewButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-view-button');
  readonly deleteButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-delete-button');
}
