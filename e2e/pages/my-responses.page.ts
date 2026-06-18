import { Page } from '@playwright/test';

// SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: Playwright page object exposing locators for the my-responses list (pure)
export class MyResponsesPage {
  // SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: bind Playwright page instance to the page object (pure)
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
